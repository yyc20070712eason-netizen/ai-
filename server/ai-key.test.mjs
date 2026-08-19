import { describe, expect, it, vi } from 'vitest'
import { safeAiFailure, validateApiKey } from './ai-key.mjs'

describe('AI Key validation', () => {
  it('marks a key valid only when a minimal text request succeeds', async () => {
    const list = vi.fn().mockRejectedValue(Object.assign(new Error('models unavailable'), { status: 404 }))
    const create = vi.fn().mockResolvedValue({ output_text: 'OK', usage: { input_tokens: 1, output_tokens: 1 } })
    await expect(validateApiKey('official-test', () => ({ models: { list }, responses: { create }, embeddings: { create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1] }] }) } }))).resolves.toMatchObject({ keyStatus: 'valid' })
    expect(create).toHaveBeenCalledOnce()
  })

  it.each([
    [401, 'invalid'],
    [403, 'restricted'],
    [429, 'unverified'],
    [500, 'unverified'],
  ])('maps status %s without exposing the provider message', async (status, expected) => {
    const providerError = Object.assign(new Error('Incorrect API key provided: sk-secret-fragment'), { status })
    const result = await validateApiKey('official-test', () => ({
      models: { list: vi.fn().mockResolvedValue({ data: [] }) },
      responses: { create: vi.fn().mockRejectedValue(providerError) },
      embeddings: { create: vi.fn() },
    }))
    expect(result.keyStatus).toBe(expected)
    expect(JSON.stringify(result)).not.toContain('sk-secret-fragment')
  })

  it('returns safe, actionable provider failures', () => {
    const failure = safeAiFailure(Object.assign(new Error('Incorrect API key provided: sk-secret-fragment'), { status: 401 }))
    expect(failure).toMatchObject({ code: 'api_key_invalid', statusCode: 401 })
    expect(failure.message).not.toContain('sk-')
  })
})
