import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { AiProviderStore } from './ai-config.mjs'

const roots = []
const protect = (value) => Buffer.from(`cipher:${value}`, 'utf8').toString('base64')
const unprotect = (value) => Buffer.from(value, 'base64').toString('utf8').replace(/^cipher:/u, '')

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

async function makeStore() {
  const root = await mkdtemp(join(tmpdir(), 'ai-provider-store-'))
  roots.push(root)
  const store = new AiProviderStore({ dataDir: root, protect, unprotect, env: {} })
  await store.init()
  return { root, store }
}

describe('AI provider store', () => {
  it('keeps official and relay secrets isolated and ciphertext-only', async () => {
    const { root, store } = await makeStore()
    await store.saveSecret('openai', 'official-secret')
    await store.saveSecret('relay', 'relay-secret')
    await store.saveConfig({
      activeProvider: 'relay',
      relay: { kind: 'relay', baseUrl: 'https://relay.example.com/v1', textApi: 'auto', textModel: 'relay-chat', embeddingMode: 'disabled' },
    })
    expect(await store.getSecret('openai')).toBe('official-secret')
    expect(await store.getSecret('relay')).toBe('relay-secret')
    const config = await readFile(join(root, 'secrets', 'ai-provider.json'), 'utf8')
    const officialCipher = await readFile(join(root, 'secrets', 'openai-key.dpapi'), 'utf8')
    const relayCipher = await readFile(join(root, 'secrets', 'relay-key.dpapi'), 'utf8')
    expect(`${config}${officialCipher}${relayCipher}`).not.toContain('official-secret')
    expect(`${config}${officialCipher}${relayCipher}`).not.toContain('relay-secret')
  })

  it('uses the legacy official secret and status without rewriting them', async () => {
    const { root, store } = await makeStore()
    const secretPath = join(root, 'secrets', 'openai-key.dpapi')
    await writeFile(secretPath, protect('legacy-official'), 'utf8')
    await writeFile(join(root, 'secrets', 'openai-key-status.json'), JSON.stringify({ keyStatus: 'valid', validatedAt: '2026-08-12T00:00:00.000Z' }), 'utf8')
    const before = await readFile(secretPath, 'utf8')
    const status = await store.describe()
    expect(status).toMatchObject({ activeProvider: 'openai', hasApiKey: true, keyStatus: 'valid' })
    expect(await readFile(secretPath, 'utf8')).toBe(before)
  })

  it('removes only the relay profile and returns to official', async () => {
    const { store } = await makeStore()
    await store.saveSecret('openai', 'official-secret')
    await store.saveSecret('relay', 'relay-secret')
    await store.saveConfig({ activeProvider: 'relay', relay: { kind: 'relay', baseUrl: 'https://relay.example.com/v1', textApi: 'auto', textModel: 'relay-chat', embeddingMode: 'disabled' } })
    await store.removeRelay()
    expect(await store.getSecret('openai')).toBe('official-secret')
    expect(await store.getSecret('relay')).toBe('')
    expect((await store.loadConfig()).activeProvider).toBe('openai')
  })

  it('persists only recognized network resolution metadata', async () => {
    const { root, store } = await makeStore()
    const status = {
      keyStatus: 'valid',
      models: [],
      capabilities: { authentication: 'valid', text: 'responses', embeddings: 'not-tested' },
      canActivate: true,
      networkResolution: 'proxy-fake-ip',
    }
    await store.saveStatus('relay', status)
    expect((await store.loadStatuses()).relay).toMatchObject({ networkResolution: 'proxy-fake-ip' })

    const statusPath = join(root, 'secrets', 'ai-provider-status.json')
    const raw = JSON.parse(await readFile(statusPath, 'utf8'))
    raw.relay.networkResolution = 'untrusted-value'
    await writeFile(statusPath, JSON.stringify(raw), 'utf8')
    expect((await store.loadStatuses()).relay).not.toHaveProperty('networkResolution')
  })
})
