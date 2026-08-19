import { describe, expect, it, vi } from 'vitest'
import {
  addressIsPrivate,
  assertSafeBaseUrl,
  baseUrlCandidates,
  generateProviderJson,
  inspectSafeBaseUrl,
  makeRestrictedFetch,
  normalizeProviderConfig,
  probeProvider,
  resolvePublicAddressesViaDoh,
  validateApiSecret,
} from './ai-provider.mjs'

const publicResolver = vi.fn().mockResolvedValue([{ address: '8.8.8.8', family: 4 }])

function relay(overrides = {}) {
  return {
    kind: 'relay',
    baseUrl: 'https://relay.example.com',
    textApi: 'auto',
    textModel: 'relay-chat',
    embeddingMode: 'auto',
    embeddingModel: 'relay-embedding',
    ...overrides,
  }
}

function client({ models = [], response, chat, embedding } = {}) {
  return {
    models: { list: vi.fn().mockImplementation(async () => {
      if (models instanceof Error) throw models
      return { data: models.map((id) => ({ id })) }
    }) },
    responses: { create: vi.fn().mockImplementation(async () => {
      if (response instanceof Error) throw response
      return response || { output_text: 'OK', usage: { input_tokens: 1, output_tokens: 1 } }
    }) },
    chat: { completions: { create: vi.fn().mockImplementation(async () => {
      if (chat instanceof Error) throw chat
      return chat || { choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }
    }) } },
    embeddings: { create: vi.fn().mockImplementation(async () => {
      if (embedding instanceof Error) throw embedding
      return embedding || { data: [{ embedding: [0.1, 0.2] }] }
    }) },
  }
}

describe('AI provider configuration', () => {
  it('accepts provider keys without an sk prefix and rejects controls', () => {
    expect(validateApiSecret('relay-token-123')).toBe('relay-token-123')
    expect(() => validateApiSecret('bad\nkey')).toThrow(/控制字符/u)
  })

  it('normalizes /v1 without duplicating it', () => {
    expect(baseUrlCandidates('https://relay.example.com')).toEqual([
      'https://relay.example.com/v1',
      'https://relay.example.com',
    ])
    expect(baseUrlCandidates('https://relay.example.com/v1')).toEqual(['https://relay.example.com/v1'])
    expect(normalizeProviderConfig(relay({ baseUrl: 'https://relay.example.com/v1/' })).baseUrl).toBe('https://relay.example.com/v1')
  })

  it('allows only HTTPS public endpoints or local HTTP', async () => {
    await expect(assertSafeBaseUrl('http://127.0.0.1:8787/v1')).resolves.toContain('127.0.0.1')
    await expect(assertSafeBaseUrl('https://relay.example.com/v1', publicResolver)).resolves.toBe('https://relay.example.com/v1')
    await expect(assertSafeBaseUrl('http://relay.example.com/v1', publicResolver)).rejects.toMatchObject({ code: 'insecure_base_url' })
    await expect(assertSafeBaseUrl('https://192.168.1.2/v1')).rejects.toMatchObject({ code: 'private_base_url' })
    expect(addressIsPrivate('10.0.0.1')).toBe(true)
    expect(addressIsPrivate('203.0.113.10')).toBe(true)
    expect(addressIsPrivate('8.8.8.8')).toBe(false)
  })

  it('safely verifies a proxy fake-IP through public DoH results', async () => {
    const fakeIpResolver = vi.fn().mockResolvedValue([{ address: '198.18.0.124', family: 4 }])
    const dohResolver = vi.fn().mockResolvedValue(['104.18.42.98', '2606:4700::6812:2a62'])
    await expect(inspectSafeBaseUrl('https://relay.example.com/v1', { resolver: fakeIpResolver, dohResolver })).resolves.toEqual({
      baseUrl: 'https://relay.example.com/v1',
      networkResolution: 'proxy-fake-ip',
    })
    expect(dohResolver).toHaveBeenCalledWith('relay.example.com')
  })

  it('never uses DoH to bypass direct or ordinary private addresses', async () => {
    const dohResolver = vi.fn().mockResolvedValue(['8.8.8.8'])
    await expect(assertSafeBaseUrl('https://198.18.0.124/v1', publicResolver, dohResolver)).rejects.toMatchObject({ code: 'private_base_url' })
    const privateResolver = vi.fn().mockResolvedValue([{ address: '192.168.1.20', family: 4 }])
    await expect(inspectSafeBaseUrl('https://relay.example.com/v1', { resolver: privateResolver, dohResolver })).rejects.toMatchObject({ code: 'private_base_url' })
    expect(dohResolver).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', vi.fn().mockResolvedValue([])],
    ['private', vi.fn().mockResolvedValue(['10.0.0.8'])],
    ['failure', vi.fn().mockRejectedValue(new Error('offline'))],
  ])('rejects fake-IP when DoH verification is %s', async (_label, dohResolver) => {
    const fakeIpResolver = vi.fn().mockResolvedValue([{ address: '198.18.0.124', family: 4 }])
    await expect(inspectSafeBaseUrl('https://relay.example.com/v1', { resolver: fakeIpResolver, dohResolver })).rejects.toMatchObject({
      code: 'proxy_fake_ip_unverified',
    })
  })

  it('does not query DoH for an ordinary public DNS result', async () => {
    const dohResolver = vi.fn()
    await expect(inspectSafeBaseUrl('https://relay.example.com/v1', { resolver: publicResolver, dohResolver })).resolves.toMatchObject({ networkResolution: 'system-dns' })
    expect(dohResolver).not.toHaveBeenCalled()
  })

  it('falls back from Cloudflare to Google DoH and accepts only address answers', async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = new URL(input)
      if (url.hostname === 'cloudflare-dns.com') throw new Error('offline')
      return new Response(JSON.stringify({
        Status: 0,
        Answer: url.searchParams.get('type') === 'A'
          ? [{ type: 5, data: 'edge.example.com.' }, { type: 1, data: '104.18.42.98' }]
          : [{ type: 28, data: '2606:4700::6812:2a62' }],
      }), { status: 200, headers: { 'Content-Type': 'application/dns-json' } })
    })
    await expect(resolvePublicAddressesViaDoh('relay.example.com', fetchImpl)).resolves.toEqual(['104.18.42.98', '2606:4700::6812:2a62'])
    expect(fetchImpl.mock.calls.some(([input]) => new URL(input).hostname === 'dns.google')).toBe(true)
  })

  it('rechecks fake-IP resolution for outbound requests and blocks redirects', async () => {
    const fakeIpResolver = vi.fn().mockResolvedValue([{ address: '198.18.0.124', family: 4 }])
    const dohResolver = vi.fn().mockResolvedValue(['104.18.42.98'])
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 200 }))
    const restrictedFetch = makeRestrictedFetch('https://relay.example.com/v1', fetchImpl, { resolver: fakeIpResolver, dohResolver })
    await expect(restrictedFetch('https://relay.example.com/v1/models')).resolves.toHaveProperty('status', 200)
    expect(fakeIpResolver).toHaveBeenCalled()
    expect(dohResolver).toHaveBeenCalled()
    await expect(restrictedFetch('https://other.example.com/v1/models')).rejects.toMatchObject({ code: 'unsafe_redirect' })
    fetchImpl.mockResolvedValueOnce(new Response('', { status: 302, headers: { Location: 'https://other.example.com/' } }))
    await expect(restrictedFetch('https://relay.example.com/v1/models')).rejects.toMatchObject({ code: 'unsafe_redirect' })
  })
})

describe('AI provider probing', () => {
  it('validates actual Responses and embedding capabilities even when /models is unavailable', async () => {
    const fake = client({ models: Object.assign(new Error('missing'), { status: 404 }) })
    const result = await probeProvider(relay(), 'relay-token', { resolver: publicResolver, createClient: () => fake })
    expect(result).toMatchObject({
      keyStatus: 'valid',
      canActivate: true,
      models: [],
      capabilities: { authentication: 'valid', text: 'responses', embeddings: 'available' },
    })
  })

  it('reports safely verified proxy fake-IP resolution with a successful probe', async () => {
    const fakeIpResolver = vi.fn().mockResolvedValue([{ address: '198.18.0.124', family: 4 }])
    const result = await probeProvider(relay(), 'relay-token', {
      resolver: fakeIpResolver,
      dohResolver: vi.fn().mockResolvedValue(['104.18.42.98']),
      createClient: () => client(),
    })
    expect(result).toMatchObject({ keyStatus: 'valid', networkResolution: 'proxy-fake-ip' })
  })

  it('falls back from Responses to Chat Completions', async () => {
    const fake = client({ response: Object.assign(new Error('not found'), { status: 404 }) })
    const result = await probeProvider(relay({ embeddingMode: 'disabled', embeddingModel: undefined }), 'relay-token', {
      resolver: publicResolver,
      createClient: () => fake,
    })
    expect(result.capabilities).toEqual({ authentication: 'valid', text: 'chat-completions', embeddings: 'not-tested' })
    expect(fake.chat.completions.create).toHaveBeenCalledOnce()
  })

  it('does not reject text-only relays when embeddings fail', async () => {
    const fake = client({ embedding: Object.assign(new Error('missing'), { status: 404 }) })
    const result = await probeProvider(relay(), 'relay-token', { resolver: publicResolver, createClient: () => fake })
    expect(result.keyStatus).toBe('valid')
    expect(result.capabilities.embeddings).toBe('unavailable')
    expect(result.canActivate).toBe(true)
  })

  it.each([
    [401, 'invalid', false],
    [403, 'restricted', false],
    [429, 'unverified', true],
    [500, 'unverified', true],
  ])('maps text probe status %s without exposing upstream details', async (status, keyStatus, canActivate) => {
    const fake = client({ response: Object.assign(new Error('secret relay-token'), { status }) })
    const result = await probeProvider(relay(), 'relay-token', { resolver: publicResolver, createClient: () => fake })
    expect(result).toMatchObject({ keyStatus, canActivate })
    expect(JSON.stringify(result)).not.toContain('relay-token')
    if (status === 401) expect(result.error).toContain('由该中转站签发')
  })
})

describe('Chat structured output fallback', () => {
  it('falls back to json_object and locally validates the result', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('schema unsupported'), { status: 400 }))
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"answer":"可以"}' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } })
    const runtime = {
      profile: relay({ textApi: 'chat-completions', embeddingMode: 'disabled', embeddingModel: undefined }),
      textApi: 'chat-completions',
      client: { chat: { completions: { create } } },
    }
    const result = await generateProviderJson(runtime, {
      input: '回答',
      schemaName: 'answer',
      schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
    })
    expect(result.value).toEqual({ answer: '可以' })
    expect(result).toMatchObject({ inputTokens: 3, outputTokens: 2 })
  })
})
