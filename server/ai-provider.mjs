import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import OpenAI from 'openai'

export const OFFICIAL_PROFILE = Object.freeze({
  kind: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  textApi: 'responses',
  textModel: 'gpt-5.6-terra',
  embeddingMode: 'enabled',
  embeddingModel: 'text-embedding-3-small',
})

const TEXT_APIS = new Set(['auto', 'responses', 'chat-completions'])
const EMBEDDING_MODES = new Set(['auto', 'enabled', 'disabled'])
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const FALLBACK_STATUSES = new Set([400, 404, 405, 415, 422])
const DOH_ENDPOINTS = Object.freeze([
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve',
])

function cleanString(value, maxLength) {
  const hasControlCharacter = typeof value === 'string' && [...value].some((character) => {
    const code = character.codePointAt(0) || 0
    return code <= 31 || code === 127
  })
  return typeof value === 'string' && value.trim() && value.trim().length <= maxLength && !hasControlCharacter
    ? value.trim()
    : ''
}

export function validateApiSecret(value) {
  const key = cleanString(value, 4096)
  if (!key) throw Object.assign(new Error('API Key 不能为空，且不能包含控制字符。'), { statusCode: 400, code: 'invalid_api_key_format' })
  return key
}

export function ipv4IsBenchmarkFakeIp(address) {
  const octets = address.split('.').map(Number)
  return octets.length === 4 && octets.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
    && octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)
}

function ipv4IsPrivate(address) {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return true
  const [a, b] = octets
  return a === 0 || a === 10 || a === 127
    || a === 100 && b >= 64 && b <= 127
    || a === 169 && b === 254
    || a === 172 && b >= 16 && b <= 31
    || a === 192 && [0, 168].includes(b)
    || ipv4IsBenchmarkFakeIp(address)
    || a === 198 && b === 51
    || a === 203 && b === 0
    || a >= 224
}

function ipv6IsPrivate(address) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/u.test(normalized) || normalized.startsWith('ff')
}

export function addressIsPrivate(address) {
  const kind = isIP(address.replace(/^\[|\]$/g, ''))
  if (kind === 4) return ipv4IsPrivate(address)
  if (kind === 6) return ipv6IsPrivate(address)
  return true
}

function safeBaseUrlError(message, code) {
  return Object.assign(new Error(message), { statusCode: 400, code })
}

function resolvedAddresses(records) {
  return (Array.isArray(records) ? records : records ? [records] : [])
    .map((item) => typeof item === 'string' ? item : item?.address)
    .filter((address) => typeof address === 'string' && isIP(address.replace(/^\[|\]$/gu, '')))
}

function dohAddresses(payload) {
  if (!payload || Number(payload.Status) !== 0 || !Array.isArray(payload.Answer)) return []
  return payload.Answer
    .filter((item) => item?.type === 1 || item?.type === 28)
    .map((item) => String(item.data || '').replace(/^\[|\]$/gu, ''))
    .filter((address) => isIP(address))
}

async function queryDohEndpoint(endpoint, hostname, fetchImpl) {
  const addresses = []
  for (const type of ['A', 'AAAA']) {
    const url = new URL(endpoint)
    url.searchParams.set('name', hostname)
    url.searchParams.set('type', type)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/dns-json' },
        redirect: 'error',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`DoH ${response.status}`)
      addresses.push(...dohAddresses(await response.json()))
    } finally {
      clearTimeout(timeout)
    }
  }
  return [...new Set(addresses)]
}

export async function resolvePublicAddressesViaDoh(hostname, fetchImpl = globalThis.fetch) {
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const addresses = await queryDohEndpoint(endpoint, hostname, fetchImpl)
      if (addresses.length) return addresses
    } catch { /* fall back to the next fixed resolver */ }
  }
  return []
}

export function baseUrlCandidates(value) {
  const input = cleanString(value, 2048)
  if (!input) throw Object.assign(new Error('请填写中转站 Base URL。'), { statusCode: 400, code: 'invalid_base_url' })
  let url
  try { url = new URL(input) } catch { throw Object.assign(new Error('Base URL 格式不正确。'), { statusCode: 400, code: 'invalid_base_url' }) }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('Base URL 必须是无账号、查询参数或片段的 HTTP(S) 地址。'), { statusCode: 400, code: 'invalid_base_url' })
  }
  const hostname = url.hostname.toLowerCase()
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(hostname) && !LOOPBACK_HOSTS.has(url.host.toLowerCase())) {
    throw Object.assign(new Error('公网中转站必须使用 HTTPS；HTTP 只允许本机地址。'), { statusCode: 400, code: 'insecure_base_url' })
  }
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/'
  const exact = url.toString().replace(/\/$/u, '')
  if (/\/v1$/u.test(url.pathname)) return [exact]
  const withV1 = new URL(url)
  withV1.pathname = `${url.pathname === '/' ? '' : url.pathname}/v1`
  return [...new Set([withV1.toString().replace(/\/$/u, ''), exact])]
}

export async function inspectSafeBaseUrl(value, options = {}) {
  const resolver = options.resolver || lookup
  const dohResolver = options.dohResolver || resolvePublicAddressesViaDoh
  const [candidate] = baseUrlCandidates(value)
  const url = new URL(candidate)
  const hostname = url.hostname.toLowerCase()
  if (LOOPBACK_HOSTS.has(hostname) || LOOPBACK_HOSTS.has(url.host.toLowerCase())) {
    return { baseUrl: candidate, networkResolution: 'system-dns' }
  }
  if (isIP(hostname) && addressIsPrivate(hostname)) {
    throw safeBaseUrlError('不允许直接连接局域网、代理 fake-IP 或其他保留地址。', 'private_base_url')
  }
  let records
  try { records = await resolver(hostname, { all: true, verbatim: true }) } catch {
    throw safeBaseUrlError('无法解析中转站域名，请检查 Base URL。', 'base_url_unresolved')
  }
  const addresses = resolvedAddresses(records)
  if (!addresses.length) throw safeBaseUrlError('无法解析中转站域名，请检查 Base URL。', 'base_url_unresolved')
  if (addresses.every(ipv4IsBenchmarkFakeIp)) {
    let publicAddresses
    try { publicAddresses = await dohResolver(hostname) } catch { publicAddresses = [] }
    const verified = resolvedAddresses(publicAddresses)
    if (!verified.length || verified.some(addressIsPrivate)) {
      throw safeBaseUrlError('检测到代理 fake-IP，但公网地址验证失败。请检查 VPN 网络或稍后重试。', 'proxy_fake_ip_unverified')
    }
    return { baseUrl: candidate, networkResolution: 'proxy-fake-ip' }
  }
  if (addresses.some(addressIsPrivate)) {
    throw safeBaseUrlError('中转站域名解析到了不允许的局域网或保留地址。', 'private_base_url')
  }
  return { baseUrl: candidate, networkResolution: 'system-dns' }
}

export async function assertSafeBaseUrl(value, resolver = lookup, dohResolver = resolvePublicAddressesViaDoh) {
  return (await inspectSafeBaseUrl(value, { resolver, dohResolver })).baseUrl
}

export function normalizeProviderConfig(value) {
  if (!value || value.kind === 'openai') return { ...OFFICIAL_PROFILE }
  if (value.kind !== 'relay') throw Object.assign(new Error('AI 提供商类型无效。'), { statusCode: 400, code: 'invalid_provider' })
  const textModel = cleanString(value.textModel, 256)
  if (!textModel) throw Object.assign(new Error('请填写中转站的文本模型名称。'), { statusCode: 400, code: 'invalid_text_model' })
  const textApi = TEXT_APIS.has(value.textApi) ? value.textApi : 'auto'
  const embeddingMode = EMBEDDING_MODES.has(value.embeddingMode) ? value.embeddingMode : 'auto'
  const embeddingModel = cleanString(value.embeddingModel, 256)
  if (embeddingMode === 'enabled' && !embeddingModel) throw Object.assign(new Error('启用向量检索时必须填写嵌入模型名称。'), { statusCode: 400, code: 'invalid_embedding_model' })
  return {
    kind: 'relay',
    baseUrl: baseUrlCandidates(value.baseUrl)[0],
    textApi,
    textModel,
    embeddingMode,
    ...(embeddingModel ? { embeddingModel } : {}),
  }
}

function statusOf(error) {
  return Number(error?.status ?? error?.statusCode) || 0
}

export function safeAiFailure(error, providerLabel = 'AI 服务') {
  const status = statusOf(error)
  if (status === 401) return {
    statusCode: 401,
    code: 'api_key_invalid',
    message: providerLabel === '中转站'
      ? '该中转站拒绝了此 API Key；请确认 Key 由该中转站签发，并检查 Base URL。'
      : `${providerLabel}拒绝了 API Key，请检查密钥。`,
  }
  if (status === 403) return { statusCode: 403, code: 'api_key_restricted', message: `${providerLabel}未授权当前模型或接口。` }
  if (status === 429) return { statusCode: 429, code: 'api_rate_limited', message: `${providerLabel}当前限流或额度不足，请稍后重试。` }
  if ([400, 404, 405, 415, 422].includes(status)) return { statusCode: 503, code: 'model_unavailable', message: '当前模型或兼容接口不可用，请检查模型名称与接口类型。' }
  if (status >= 500) return { statusCode: 503, code: 'api_unavailable', message: `${providerLabel}暂时不可用，请稍后重试。` }
  const code = String(error?.code ?? '')
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'unsafe_redirect'].includes(code) || error?.name === 'APIConnectionError') {
    return { statusCode: 503, code: 'api_offline', message: `无法连接${providerLabel}，请检查网络与 Base URL。` }
  }
  return { statusCode: 503, code: 'api_unavailable', message: `${providerLabel}请求失败，请检查配置后重试。` }
}

export function makeRestrictedFetch(baseUrl, fetchImpl = globalThis.fetch, options = {}) {
  const allowedOrigin = new URL(baseUrl).origin
  return async (input, init = {}) => {
    const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (target.origin !== allowedOrigin) throw Object.assign(new Error('提供商请求试图离开已配置域名。'), { code: 'unsafe_redirect', status: 502 })
    await inspectSafeBaseUrl(target.origin, options)
    const response = await fetchImpl(input, { ...init, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      throw Object.assign(new Error('提供商返回了不安全的跨站重定向。'), { code: 'unsafe_redirect', status: 502 })
    }
    return response
  }
}

export function createProviderClient(profile, apiKey, baseUrl = profile.baseUrl, options = {}) {
  return new OpenAI({
    apiKey: validateApiSecret(apiKey),
    baseURL: baseUrl,
    maxRetries: 0,
    timeout: 30_000,
    fetch: makeRestrictedFetch(baseUrl, options.fetchImpl, options),
  })
}

function usageOf(response) {
  return {
    inputTokens: Number(response?.usage?.input_tokens ?? response?.usage?.prompt_tokens ?? 0) || 0,
    outputTokens: Number(response?.usage?.output_tokens ?? response?.usage?.completion_tokens ?? 0) || 0,
  }
}

function chatContent(response) {
  const content = response?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((item) => typeof item === 'string' ? item : item?.text || '').join('')
  return ''
}

async function responseText(client, profile, options) {
  const response = await client.responses.create({
    model: profile.textModel,
    store: false,
    ...(options.reasoning ? { reasoning: { effort: options.reasoning } } : {}),
    text: options.schema ? {
      ...(options.verbosity ? { verbosity: options.verbosity } : {}),
      format: { type: 'json_schema', name: options.schemaName || 'structured_output', strict: true, schema: options.schema },
    } : options.verbosity ? { verbosity: options.verbosity } : undefined,
    input: options.input,
    ...(options.maxOutputTokens ? { max_output_tokens: options.maxOutputTokens } : {}),
  })
  return { outputText: response.output_text || '', ...usageOf(response) }
}

async function chatText(client, profile, options) {
  const base = {
    model: profile.textModel,
    messages: [{ role: 'user', content: options.input }],
    ...(options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {}),
  }
  let response
  if (options.schema) {
    try {
      response = await client.chat.completions.create({
        ...base,
        response_format: { type: 'json_schema', json_schema: { name: options.schemaName || 'structured_output', strict: true, schema: options.schema } },
      })
    } catch (error) {
      if (![400, 415, 422].includes(statusOf(error))) throw error
      response = await client.chat.completions.create({
        ...base,
        messages: [{ role: 'user', content: `${options.input}\n\n只输出一个有效 JSON 对象，不要使用 Markdown 代码块。` }],
        response_format: { type: 'json_object' },
      })
    }
  } else {
    response = await client.chat.completions.create(base)
  }
  return { outputText: chatContent(response), ...usageOf(response) }
}

function shouldFallback(error) {
  return FALLBACK_STATUSES.has(statusOf(error))
}

export async function generateProviderText(runtime, options) {
  const selected = runtime.textApi === 'auto' ? runtime.detectedTextApi || 'responses' : runtime.textApi
  if (selected === 'chat-completions') return chatText(runtime.client, runtime.profile, options)
  try {
    return await responseText(runtime.client, runtime.profile, options)
  } catch (error) {
    if (runtime.profile.kind !== 'relay' || runtime.textApi !== 'auto' || !shouldFallback(error)) throw error
    return chatText(runtime.client, runtime.profile, options)
  }
}

function matchesSchema(value, schema) {
  if (schema?.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    if ((schema.required || []).some((key) => !(key in value))) return false
    return Object.entries(schema.properties || {}).every(([key, child]) => !(key in value) || matchesSchema(value[key], child))
  }
  if (schema?.type === 'array') return Array.isArray(value) && value.every((item) => matchesSchema(item, schema.items)) && (!schema.maxItems || value.length <= schema.maxItems)
  if (schema?.type === 'string') return typeof value === 'string' && (!schema.enum || schema.enum.includes(value))
  if (schema?.type === 'integer') return Number.isInteger(value)
  if (schema?.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (schema?.type === 'boolean') return typeof value === 'boolean'
  return true
}

export async function generateProviderJson(runtime, options) {
  let result = await generateProviderText(runtime, options)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const parsed = JSON.parse(result.outputText)
      if (matchesSchema(parsed, options.schema)) return { value: parsed, inputTokens: result.inputTokens, outputTokens: result.outputTokens }
    } catch { /* one bounded repair follows */ }
    if (attempt === 1) break
    const repaired = await generateProviderText(runtime, {
      ...options,
      input: `${options.input}\n\n上一次输出不符合 JSON 结构。重新输出严格满足结构的 JSON；不要解释，也不要使用代码块。`,
    })
    result = {
      outputText: repaired.outputText,
      inputTokens: result.inputTokens + repaired.inputTokens,
      outputTokens: result.outputTokens + repaired.outputTokens,
    }
  }
  throw Object.assign(new Error('AI 返回格式异常，请重试。'), { statusCode: 502, code: 'invalid_ai_output' })
}

export async function embedProviderTexts(runtime, texts) {
  if (!runtime.profile.embeddingModel || runtime.profile.embeddingMode === 'disabled') return null
  const response = await runtime.client.embeddings.create({ model: runtime.profile.embeddingModel, input: texts })
  return response.data.map((item) => item.embedding)
}

async function listModels(client) {
  try {
    const page = await client.models.list()
    const data = Array.isArray(page?.data) ? page.data : []
    return data.map((item) => String(item.id || '')).filter(Boolean).slice(0, 100)
  } catch { return [] }
}

async function probeText(client, profile) {
  const options = { input: '只回复 OK', maxOutputTokens: 16 }
  if (profile.textApi === 'responses') {
    await responseText(client, profile, options)
    return 'responses'
  }
  if (profile.textApi === 'chat-completions') {
    await chatText(client, profile, options)
    return 'chat-completions'
  }
  try {
    await responseText(client, profile, options)
    return 'responses'
  } catch (error) {
    if (!shouldFallback(error)) throw error
    await chatText(client, profile, options)
    return 'chat-completions'
  }
}

function blankCapabilities() {
  return { authentication: 'unverified', text: 'unavailable', embeddings: 'not-tested' }
}

export async function probeProvider(inputProfile, apiKey, options = {}) {
  const profile = normalizeProviderConfig(inputProfile)
  validateApiSecret(apiKey)
  const candidates = profile.kind === 'openai' ? [profile.baseUrl] : baseUrlCandidates(inputProfile.baseUrl)
  let lastError
  let networkResolution
  for (const baseUrl of candidates) {
    const resolution = await inspectSafeBaseUrl(baseUrl, { resolver: options.resolver, dohResolver: options.dohResolver })
    networkResolution = resolution.networkResolution
    const client = options.createClient ? options.createClient(profile, apiKey, baseUrl) : createProviderClient(profile, apiKey, baseUrl, options)
    const models = await listModels(client)
    try {
      const text = await probeText(client, profile)
      let embeddings = 'not-tested'
      if (profile.embeddingMode !== 'disabled' && profile.embeddingModel) {
        try {
          const vectors = await embedProviderTexts({ client, profile }, ['连接测试'])
          embeddings = Array.isArray(vectors) && vectors.length === 1 ? 'available' : 'unavailable'
        } catch { embeddings = 'unavailable' }
      }
      return {
        keyStatus: 'valid',
        validatedAt: new Date().toISOString(),
        resolvedBaseUrl: baseUrl,
        networkResolution,
        models,
        capabilities: { authentication: 'valid', text, embeddings },
        canActivate: true,
      }
    } catch (error) {
      lastError = error
      const status = statusOf(error)
      if (status === 401 || status === 403) break
      if (!FALLBACK_STATUSES.has(status)) break
    }
  }
  const failure = safeAiFailure(lastError, profile.kind === 'relay' ? '中转站' : 'OpenAI')
  const keyStatus = failure.code === 'api_key_invalid' ? 'invalid' : failure.code === 'api_key_restricted' ? 'restricted' : 'unverified'
  const definitive = ['api_key_invalid', 'api_key_restricted', 'model_unavailable'].includes(failure.code)
  return {
    keyStatus,
    ...(keyStatus !== 'unverified' ? { validatedAt: new Date().toISOString() } : {}),
    resolvedBaseUrl: candidates[0],
    ...(networkResolution ? { networkResolution } : {}),
    models: [],
    capabilities: { ...blankCapabilities(), authentication: keyStatus === 'invalid' ? 'invalid' : 'unverified' },
    canActivate: !definitive,
    error: failure.message,
    code: failure.code,
  }
}

export function createRuntime(profile, apiKey, status, options = {}) {
  const normalized = normalizeProviderConfig(profile)
  const baseUrl = status?.resolvedBaseUrl || normalized.baseUrl
  return {
    profile: normalized,
    textApi: normalized.textApi,
    detectedTextApi: status?.capabilities?.text && status.capabilities.text !== 'unavailable' ? status.capabilities.text : undefined,
    client: options.createClient ? options.createClient(normalized, apiKey, baseUrl) : createProviderClient(normalized, apiKey, baseUrl, options),
  }
}
