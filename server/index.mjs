import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { WorkspaceStore, MAX_DOCUMENT_BYTES } from './workspace.mjs'
import { protectAndVerifySecret, unprotectSecret } from './dpapi.mjs'
import { AiProviderStore } from './ai-config.mjs'
import {
  OFFICIAL_PROFILE,
  assertSafeBaseUrl,
  createRuntime,
  embedProviderTexts,
  generateProviderJson,
  generateProviderText,
  normalizeProviderConfig,
  probeProvider,
  safeAiFailure,
  validateApiSecret,
} from './ai-provider.mjs'
import { parseReleaseHistory } from '../shared/release-history.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.AI_STUDY_PORT || 43118)
const APP_ROOT = fileURLToPath(new URL('../', import.meta.url))
const DIST_DIR = join(APP_ROOT, 'dist')
const ARCHIVE_CATALOG = JSON.parse(await readFile(join(APP_ROOT, 'shared', 'archive-catalog.json'), 'utf8')).items
const ARCHIVE_IDS = new Set(ARCHIVE_CATALOG.map((item) => item.id))
const DATA_DIR = process.env.AI_STUDY_DATA_DIR || join(process.env.LOCALAPPDATA || APP_ROOT, 'AIStudyPlan', 'data')
const LOG_DIR = join(DATA_DIR, 'logs')
const PDF_DIAGNOSTIC_LOG = join(LOG_DIR, 'pdf-render.jsonl')
const RELEASE = JSON.parse(await readFile(join(APP_ROOT, 'release.json'), 'utf8'))
const RELEASE_HISTORY = parseReleaseHistory(await readFile(join(APP_ROOT, 'CHANGELOG.md'), 'utf8'))
const store = new WorkspaceStore(DATA_DIR)
const aiProviders = new AiProviderStore({ dataDir: DATA_DIR, protect: protectAndVerifySecret, unprotect: unprotectSecret })
await store.init()
await aiProviders.init()
const archiveCleanup = store.pruneArchiveStates(ARCHIVE_IDS)
if (archiveCleanup.preserved.length) {
  console.warn(`保留了 ${archiveCleanup.preserved.length} 个带本地文件的旧归档状态，未执行删除。`)
}
async function getRuntime(required = true) {
  const current = await aiProviders.runtimeProfile()
  if (!current.apiKey) {
    if (!required) return null
    throw Object.assign(new Error('请先在设置中保存当前 AI 提供商的 API Key。'), { statusCode: 503, code: 'api_key_missing' })
  }
  return { ...createRuntime(current.profile, current.apiKey, current.status), providerKind: current.kind, status: current.status }
}

async function saveActiveFailure(failure) {
  if (!['api_key_invalid', 'api_key_restricted'].includes(failure.code)) return
  const current = await aiProviders.runtimeProfile()
  await aiProviders.saveStatus(current.kind, {
    ...(current.status || {}),
    keyStatus: failure.code === 'api_key_invalid' ? 'invalid' : 'restricted',
    validatedAt: new Date().toISOString(),
    capabilities: {
      authentication: failure.code === 'api_key_invalid' ? 'invalid' : 'unverified',
      text: 'unavailable',
      embeddings: current.status?.capabilities?.embeddings || 'not-tested',
    },
    canActivate: false,
    code: failure.code,
    error: failure.message,
  })
}

async function getReleaseInfo() {
  let build = null
  try { build = JSON.parse(await readFile(join(DIST_DIR, 'release-meta.json'), 'utf8')) } catch { /* app may not be built yet */ }
  return {
    service: 'ai-study-plan',
    version: RELEASE.version,
    appVersion: RELEASE.version,
    channel: RELEASE.channel,
    releasedAt: RELEASE.releasedAt,
    apiVersion: RELEASE.apiVersion,
    dataSchemaVersion: RELEASE.dataSchemaVersion,
    highlights: RELEASE.highlights,
    history: RELEASE_HISTORY,
    buildId: build?.buildId ?? 'unbuilt',
    builtAt: build?.builtAt ?? null,
    buildVersion: build?.version ?? null,
    compatible: Boolean(build && build.version === RELEASE.version && build.apiVersion === RELEASE.apiVersion),
  }
}

function json(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body))
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': payload.length, 'Cache-Control': 'no-store' })
  res.end(payload)
}

function validPdfDiagnostic(value) {
  if (!value || typeof value !== 'object') return false
  return Number.isInteger(value.pageNumber) && value.pageNumber > 0 && value.pageNumber <= 100_000
    && Number.isInteger(value.attempt) && value.attempt > 0 && value.attempt <= 10
    && ['load-page', 'canvas', 'text-layer'].includes(value.phase)
    && typeof value.code === 'string' && /^[a-z0-9-]{1,64}$/.test(value.code)
    && Number.isFinite(value.viewportWidth) && value.viewportWidth > 0 && value.viewportWidth <= 50_000
    && Number.isFinite(value.devicePixelRatio) && value.devicePixelRatio > 0 && value.devicePixelRatio <= 10
    && typeof value.browserVersion === 'string' && value.browserVersion.length <= 128
    && typeof value.occurredAt === 'string' && !Number.isNaN(Date.parse(value.occurredAt))
}

async function writePdfDiagnostic(value) {
  await mkdir(LOG_DIR, { recursive: true })
  try {
    if ((await stat(PDF_DIAGNOSTIC_LOG)).size >= 256 * 1024) {
      const previous = `${PDF_DIAGNOSTIC_LOG}.1`
      const oldest = `${PDF_DIAGNOSTIC_LOG}.2`
      if (existsSync(oldest)) await unlink(oldest)
      if (existsSync(previous)) await rename(previous, oldest)
      await rename(PDF_DIAGNOSTIC_LOG, previous)
    }
  } catch (reason) {
    if (reason?.code !== 'ENOENT') throw reason
  }
  await appendFile(PDF_DIAGNOSTIC_LOG, `${JSON.stringify(value)}\n`, 'utf8')
}

async function readBody(req, limit = 1024 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw Object.assign(new Error('请求内容过大。'), { statusCode: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(req, limit) {
  const body = await readBody(req, limit)
  try { return JSON.parse(body.toString('utf8')) } catch { throw Object.assign(new Error('请求 JSON 无效。'), { statusCode: 400 }) }
}

function validateOrigin(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true
  const origin = req.headers.origin
  return !origin || origin === `http://${HOST}:${PORT}`
}

function listArchiveRecords() {
  const states = new Map(store.listArchiveStates().map((item) => [item.sourceId, item]))
  return ARCHIVE_CATALOG.map((item) => {
    const documents = store.listDocuments(item.chapterId || 'archive').filter((document) => document.sourceId === item.id)
    const manual = states.get(item.id)
    const status = documents.length
      ? (documents[0].chunkCount > 0 ? 'indexed' : 'archived')
      : (manual?.status || 'pending')
    return { ...item, status, note: manual?.note || '', updatedAt: manual?.updatedAt, documents }
  })
}

async function optionalEmbeddings(runtime, texts) {
  if (!runtime || runtime.profile.embeddingMode === 'disabled' || runtime.status?.capabilities?.embeddings === 'unavailable') return null
  try { return await embedProviderTexts(runtime, texts) } catch { return null }
}

async function answerQuestion(input) {
  const runtime = await getRuntime()
  const queryVectors = await optionalEmbeddings(runtime, [input.question])
  const queryEmbedding = queryVectors?.[0] || null
  const evidence = await store.retrieve({ chapterId: input.chapterId, query: input.question, queryEmbedding })
  if (!evidence.length) {
    return {
      id: randomUUID(), chapterId: input.chapterId, stageKey: input.stageKey,
      question: input.question, answer: '当前原文没有足够依据。请先导入对应原文，或换一个更具体的问题。',
      confidence: 'low', citations: [], followUps: [], inputTokens: 0, outputTokens: 0, createdAt: new Date().toISOString(),
    }
  }
  const evidenceText = evidence.map((item, index) => `[${index + 1}] ${item.title}${item.page ? ` 第 ${item.page} 页` : ''}\n${item.body}`).join('\n\n')
  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      answer: { type: 'string' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      citationIndexes: { type: 'array', items: { type: 'integer' } },
      followUps: { type: 'array', maxItems: 2, items: { type: 'string' } },
    },
    required: ['answer', 'confidence', 'citationIndexes', 'followUps'],
  }
  const response = await generateProviderJson(runtime, {
    schema,
    schemaName: 'grounded_answer',
    reasoning: 'low',
    verbosity: 'low',
    input: `你是严谨的教材助教。只能依据证据回答；依据不足就明确说不足。用中文输出 JSON，字段为 answer、confidence(low|medium|high)、citationIndexes(数字数组)、followUps(最多2项)。\n\n问题：${input.question}\n${input.selection ? `用户选中文字：${input.selection}\n` : ''}${input.note ? `本关笔记：${input.note}\n` : ''}\n证据：\n${evidenceText}`,
  })
  const parsed = response.value
  const citations = (parsed.citationIndexes ?? []).slice(0, 6).flatMap((rawIndex) => {
    const item = evidence[Number(rawIndex) - 1]
    return item ? [{ documentId: item.documentId, chunkId: item.id, title: item.title, page: item.page, section: item.section || undefined, quote: item.body.slice(0, 220) }] : []
  })
  const answer = {
    id: randomUUID(), chapterId: input.chapterId, stageKey: input.stageKey, question: input.question,
    answer: String(parsed.answer || '当前原文没有足够依据。'),
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    citations, followUps: Array.isArray(parsed.followUps) ? parsed.followUps.slice(0, 2).map(String) : [],
    inputTokens: response.inputTokens, outputTokens: response.outputTokens, createdAt: new Date().toISOString(),
  }
  store.saveAnswer(answer)
  return answer
}

async function practiceFeedback(input) {
  const runtime = await getRuntime()
  const rubric = Array.isArray(input.rubric) ? input.rubric.slice(0, 8).map((item) => ({ id: String(item.id || '').slice(0, 80), label: String(item.label || '').slice(0, 200), criterion: String(item.criterion || '').slice(0, 600) })) : []
  const answers = Object.entries(input.answers || {}).slice(0, 8).map(([id, value]) => `${String(id).slice(0, 80)}：${String(value).slice(0, 6000)}`).join('\n\n')
  if (!String(input.title || '').trim() || !rubric.length || !answers.trim()) throw Object.assign(new Error('实践题内容不完整，无法点评。'), { statusCode: 400 })
  const schema = {
      type: 'object', additionalProperties: false,
      properties: { strengths: { type: 'array', maxItems: 3, items: { type: 'string' } }, gaps: { type: 'array', maxItems: 3, items: { type: 'string' } }, rubric: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, status: { type: 'string', enum: ['met', 'partial', 'missing'] }, note: { type: 'string' } }, required: ['id', 'status', 'note'] } }, nextStep: { type: 'string' } },
      required: ['strengths', 'gaps', 'rubric', 'nextStep'],
  }
  const response = await generateProviderJson(runtime, {
    schema,
    schemaName: 'practice_feedback',
    reasoning: 'low',
    verbosity: 'low',
    input: `你是学习教练，只依据下面的实践题和学生答案做建设性点评；不提供完整替代答案。每条简短具体。\n\n题目：${String(input.title).slice(0, 500)}\n说明：${String(input.brief || '').slice(0, 1500)}\n评分标准：${rubric.map((item) => `${item.id} | ${item.label}：${item.criterion}`).join('\n')}\n\n学生答案：\n${answers}`,
  })
  const parsed = response.value
  return { strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3).map(String) : [], gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3).map(String) : [], rubric: Array.isArray(parsed.rubric) ? parsed.rubric.filter((item) => rubric.some((rule) => rule.id === item.id)).map((item) => ({ id: String(item.id), status: ['met', 'partial', 'missing'].includes(item.status) ? item.status : 'partial', note: String(item.note).slice(0, 800) })) : [], nextStep: String(parsed.nextStep || '').slice(0, 1000), inputTokens: response.inputTokens, outputTokens: response.outputTokens, createdAt: new Date().toISOString() }
}

async function generateSummary(input) {
  const runtime = await getRuntime()
  const context = String(input.context || '').slice(0, 30_000)
  const response = await generateProviderText(runtime, {
    reasoning: 'medium', verbosity: 'medium',
    input: `请把下面的学习过程整理成中文学习小结。必须包含：已掌握、仍薄弱、下一步行动；不得发明原文没有的信息。直接输出 Markdown。\n\n${context}`,
  })
  const summary = {
    id: randomUUID(), scope: input.scope, targetKey: input.targetKey,
    title: input.title || (input.scope === 'chapter' ? '章节学习档案' : '本关学习小结'),
    body: response.outputText, citations: Array.isArray(input.citations) ? input.citations.slice(0, 12) : [],
    inputTokens: response.inputTokens, outputTokens: response.outputTokens, generatedAt: new Date().toISOString(),
  }
  return store.saveSummary(summary)
}

function providerInput(value) {
  if (value?.kind === 'openai') return { ...OFFICIAL_PROFILE }
  if (value?.kind === 'relay') return { ...(value.profile || value.relay || {}), kind: 'relay' }
  throw Object.assign(new Error('AI 提供商类型无效。'), { statusCode: 400, code: 'invalid_provider' })
}

async function testProviderConfiguration(value) {
  const profile = providerInput(value)
  const apiKey = typeof value.apiKey === 'string' && value.apiKey.trim()
    ? validateApiSecret(value.apiKey)
    : await aiProviders.getSecret(value.kind)
  if (!apiKey) return {
    keyStatus: 'missing',
    models: [],
    capabilities: { authentication: 'unverified', text: 'unavailable', embeddings: 'not-tested' },
    canActivate: false,
    error: '请先填写并保存当前提供商的 API Key。',
    code: 'api_key_missing',
  }
  return probeProvider(profile, apiKey)
}

async function saveProviderConfiguration(value) {
  const profileInputValue = providerInput(value)
  if (profileInputValue.kind === 'relay') await assertSafeBaseUrl(profileInputValue.baseUrl)
  if (typeof value.apiKey === 'string' && value.apiKey.trim()) {
    await aiProviders.saveSecret(value.kind, validateApiSecret(value.apiKey))
  }
  const result = await testProviderConfiguration({ ...value, profile: profileInputValue, apiKey: undefined })
  const current = await aiProviders.loadConfig()
  const profile = profileInputValue.kind === 'relay'
    ? { ...normalizeProviderConfig(profileInputValue), ...(result.resolvedBaseUrl ? { baseUrl: result.resolvedBaseUrl } : {}) }
    : OFFICIAL_PROFILE
  const next = {
    ...current,
    relay: value.kind === 'relay' ? profile : current.relay,
    activeProvider: value.activate !== false && result.canActivate ? value.kind : current.activeProvider,
  }
  await aiProviders.saveConfig(next)
  await aiProviders.saveStatus(value.kind, result)
  return { result, config: await aiProviders.describe() }
}

async function handleApi(req, res, url) {
  if (!validateOrigin(req)) return json(res, 403, { error: '请求来源不受信任。' })
  if (url.pathname === '/api/health' && req.method === 'GET') {
    const releaseInfo = await getReleaseInfo()
    return json(res, releaseInfo.compatible ? 200 : 503, { ok: releaseInfo.compatible, ...releaseInfo })
  }
  if (url.pathname === '/api/version' && req.method === 'GET') return json(res, 200, await getReleaseInfo())
  if (url.pathname === '/api/config/status' && req.method === 'GET') {
    return json(res, 200, await aiProviders.describe())
  }
  if (url.pathname === '/api/config/provider/test' && req.method === 'POST') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    return json(res, 200, { result: await testProviderConfiguration(await readJson(req, 32_000)) })
  }
  if (url.pathname === '/api/config/provider' && req.method === 'PUT') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    const saved = await saveProviderConfiguration(await readJson(req, 32_000))
    return json(res, 200, { ok: true, ...saved })
  }
  if (url.pathname === '/api/config/provider/relay' && req.method === 'DELETE') {
    await aiProviders.removeRelay()
    return json(res, 200, { ok: true, config: await aiProviders.describe() })
  }
  if (url.pathname === '/api/diagnostics/pdf' && req.method === 'POST') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    const diagnostic = await readJson(req, 8_000)
    if (!validPdfDiagnostic(diagnostic)) return json(res, 400, { error: 'PDF 诊断信息无效。' })
    await writePdfDiagnostic(diagnostic)
    return json(res, 204, {})
  }
  if (url.pathname === '/api/archive' && req.method === 'GET') return json(res, 200, { records: listArchiveRecords() })
  const archiveStateMatch = url.pathname.match(/^\/api\/archive\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)
  if (archiveStateMatch && req.method === 'PATCH') {
    if (!ARCHIVE_IDS.has(archiveStateMatch[1])) return json(res, 404, { error: '归档条目不存在。' })
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    const value = await readJson(req, 8_000)
    store.setArchiveState(archiveStateMatch[1], value.status, value.note || '')
    return json(res, 200, { records: listArchiveRecords() })
  }
  if (url.pathname === '/api/config/key' && req.method === 'PUT') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    const value = await readJson(req, 32_000)
    const apiKey = validateApiSecret(value.apiKey)
    await aiProviders.saveSecret('openai', apiKey)
    const validation = await probeProvider(OFFICIAL_PROFILE, apiKey)
    await aiProviders.saveStatus('openai', validation)
    return json(res, 200, { ok: true, ...validation })
  }
  if (url.pathname === '/api/documents' && req.method === 'GET') return json(res, 200, { documents: store.listDocuments(url.searchParams.get('chapterId') || '') })
  if (url.pathname === '/api/documents' && req.method === 'PUT') {
    const chapterId = url.searchParams.get('chapterId') || ''
    const sourceId = url.searchParams.get('sourceId') || ''
    const name = decodeURIComponent(url.searchParams.get('name') || 'document')
    const kind = url.searchParams.get('kind') || ''
    if (chapterId === 'archive' && !ARCHIVE_IDS.has(sourceId)) return json(res, 400, { error: '归档来源不在固定清单中。' })
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapterId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId)) return json(res, 400, { error: '章节或来源 ID 无效。' })
    if (req.headers['content-type'] !== 'application/octet-stream') return json(res, 415, { error: '文档必须以二进制方式上传。' })
    const expectedExtensions = { pdf: ['.pdf'], markdown: ['.md', '.markdown'], html: ['.html', '.htm'] }
    if (!expectedExtensions[kind]?.includes(extname(name).toLowerCase())) return json(res, 400, { error: '文件扩展名与文档类型不一致。' })
    const bytes = await readBody(req, MAX_DOCUMENT_BYTES)
    const imported = await store.importDocument({ chapterId, sourceId, name, kind, bytes, embed: null })
    const runtime = await getRuntime(false)
    if (runtime && runtime.profile.embeddingMode !== 'disabled' && runtime.status?.capabilities?.embeddings === 'available') {
      await store.indexEmbeddings(imported.document.id, (texts) => embedProviderTexts(runtime, texts)).catch(() => undefined)
    }
    if (chapterId === 'archive') store.setArchiveState(sourceId, 'pending', '')
    return json(res, 201, imported)
  }
  if (url.pathname === '/api/documents/embeddings/rebuild' && req.method === 'POST') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    const value = await readJson(req, 8_000)
    if (typeof value.chapterId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.chapterId)) return json(res, 400, { error: '章节 ID 无效。' })
    const runtime = await getRuntime()
    if (runtime.profile.embeddingMode === 'disabled' || !runtime.profile.embeddingModel) return json(res, 409, { error: '当前提供商未启用嵌入模型。', code: 'embeddings_disabled' })
    let indexedChunks = 0
    for (const document of store.listDocuments(value.chapterId)) {
      indexedChunks += await store.indexEmbeddings(document.id, (texts) => embedProviderTexts(runtime, texts), true)
    }
    return json(res, 200, { ok: true, indexedChunks })
  }
  const contentMatch = url.pathname.match(/^\/api\/documents\/([a-f0-9-]+)\/content$/)
  if (contentMatch && req.method === 'GET') {
    const document = store.getDocument(contentMatch[1])
    if (!document) return json(res, 404, { error: '文档不存在。' })
    if (document.kind === 'pdf') {
      const bytes = await store.getDocumentBytes(document.id)
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': bytes.length, 'Cache-Control': 'private, no-store' })
      return res.end(bytes)
    }
    return json(res, 200, { id: document.id, kind: document.kind, html: document.renderedHtml })
  }
  const pagesMatch = url.pathname.match(/^\/api\/documents\/([a-f0-9-]+)\/pages$/)
  if (pagesMatch && req.method === 'GET') {
    const document = store.getDocument(pagesMatch[1])
    if (!document) return json(res, 404, { error: '文档不存在。' })
    return json(res, 200, { pages: store.getDocumentPages(document.id) })
  }
  const documentMatch = url.pathname.match(/^\/api\/documents\/([a-f0-9-]+)$/)
  if (documentMatch && req.method === 'PATCH') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    const value = await readJson(req, 8_000)
    if (value.chapterId === 'archive' && !ARCHIVE_IDS.has(value.sourceId)) return json(res, 400, { error: '归档来源不在固定清单中。' })
    const moved = store.moveDocument(documentMatch[1], value.chapterId, value.sourceId)
    return moved ? json(res, 200, { document: moved }) : json(res, 404, { error: '文档不存在。' })
  }
  if (documentMatch && req.method === 'DELETE') {
    const deleted = await store.deleteDocument(documentMatch[1])
    return deleted ? json(res, 200, { ok: true }) : json(res, 404, { error: '文档不存在。' })
  }
  const artifactMatch = url.pathname.match(/^\/api\/artifacts\/([A-Za-z0-9_-]+)$/)
  if (artifactMatch && req.method === 'DELETE') {
    return store.deleteArtifact(artifactMatch[1]) ? json(res, 200, { ok: true }) : json(res, 404, { error: '学习痕迹不存在。' })
  }
  if (url.pathname === '/api/artifacts' && req.method === 'GET') return json(res, 200, { artifacts: store.listArtifacts(url.searchParams.get('chapterId') || '', url.searchParams.get('stageKey') || undefined) })
  if (url.pathname === '/api/artifacts' && req.method === 'POST') {
    const value = await readJson(req, 256_000)
    if (!value || !['highlight', 'annotation'].includes(value.type) || !value.anchor) return json(res, 400, { error: '批注内容无效。' })
    if (value.color !== undefined && !['yellow', 'green', 'blue', 'pink', 'purple'].includes(value.color)) return json(res, 400, { error: '学习痕迹颜色无效。' })
    if (value.type === 'annotation' && (typeof value.note !== 'string' || !value.note.trim() || value.note.trim().length > 20_000)) return json(res, 400, { error: '批注需要 1–20,000 个字符。' })
    return json(res, 201, { artifact: store.saveArtifact(value) })
  }
  if (url.pathname === '/api/ai/ask' && req.method === 'POST') return json(res, 200, { answer: await answerQuestion(await readJson(req, 256_000)) })
  if (url.pathname === '/api/ai/practice-feedback' && req.method === 'POST') return json(res, 200, { feedback: await practiceFeedback(await readJson(req, 80_000)) })
  if (url.pathname === '/api/ai/answers' && req.method === 'GET') return json(res, 200, { answers: store.listAnswers(url.searchParams.get('chapterId') || '', url.searchParams.get('stageKey') || undefined) })
  if (url.pathname === '/api/ai/summary' && req.method === 'POST') return json(res, 200, { summary: await generateSummary(await readJson(req, 512_000)) })
  if (url.pathname === '/api/summaries' && req.method === 'GET') return json(res, 200, { summaries: store.listSummaries(url.searchParams.get('targetKey') || '') })
  if (url.pathname === '/api/export' && req.method === 'GET') return json(res, 200, { workspace: store.exportArtifacts() })
  if (url.pathname === '/api/import' && req.method === 'POST') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { error: '需要 JSON 请求。' })
    return json(res, 200, { imported: store.importArtifacts(await readJson(req, 5 * 1024 * 1024)) })
  }
  return json(res, 404, { error: '接口不存在。' })
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' }

async function serveStatic(req, res, url) {
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1))
  const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(DIST_DIR, safe)
  if (!existsSync(filePath) || url.pathname.startsWith('/chapter/')) filePath = join(DIST_DIR, 'index.html')
  if (!existsSync(filePath)) return json(res, 404, { error: '文件不存在。' })
  const stat = await import('node:fs/promises').then(({ stat }) => stat(filePath))
  res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable' })
  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`)
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url)
    else await serveStatic(req, res, url)
  } catch (error) {
    if (error?.statusCode) {
      json(res, error.statusCode, { error: error.message || '本地服务请求失败。', code: error.code || 'request_failed' })
      return
    }
    const active = await aiProviders.runtimeProfile().catch(() => ({ kind: 'openai' }))
    const failure = safeAiFailure(error, active.kind === 'relay' ? '中转站' : 'OpenAI')
    if (String(req.url).startsWith('/api/ai/')) await saveActiveFailure(failure)
    json(res, failure.statusCode, { error: failure.message, code: failure.code })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`AI Study Plan local service ready at http://${HOST}:${PORT}`)
})
