import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { normalizeProviderConfig, OFFICIAL_PROFILE } from './ai-provider.mjs'

const STATUS_VALUES = new Set(['missing', 'unverified', 'valid', 'invalid', 'restricted'])

const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  activeProvider: 'openai',
  relay: null,
})

function safeStatus(value) {
  if (!value || !STATUS_VALUES.has(value.keyStatus)) return null
  const capabilities = value.capabilities && typeof value.capabilities === 'object'
    ? {
        authentication: ['valid', 'invalid', 'unverified'].includes(value.capabilities.authentication) ? value.capabilities.authentication : 'unverified',
        text: ['responses', 'chat-completions', 'unavailable'].includes(value.capabilities.text) ? value.capabilities.text : 'unavailable',
        embeddings: ['available', 'unavailable', 'not-tested'].includes(value.capabilities.embeddings) ? value.capabilities.embeddings : 'not-tested',
      }
    : { authentication: 'unverified', text: 'unavailable', embeddings: 'not-tested' }
  return {
    keyStatus: value.keyStatus,
    ...(typeof value.validatedAt === 'string' && !Number.isNaN(Date.parse(value.validatedAt)) ? { validatedAt: value.validatedAt } : {}),
    ...(typeof value.resolvedBaseUrl === 'string' ? { resolvedBaseUrl: value.resolvedBaseUrl } : {}),
    ...(['system-dns', 'proxy-fake-ip'].includes(value.networkResolution) ? { networkResolution: value.networkResolution } : {}),
    models: Array.isArray(value.models) ? value.models.map(String).slice(0, 100) : [],
    capabilities,
    canActivate: value.canActivate !== false,
    ...(typeof value.error === 'string' ? { error: value.error.slice(0, 1000) } : {}),
    ...(typeof value.code === 'string' ? { code: value.code.slice(0, 100) } : {}),
  }
}

export class AiProviderStore {
  constructor({ dataDir, protect, unprotect, env = process.env }) {
    this.secretDir = join(dataDir, 'secrets')
    this.configPath = join(this.secretDir, 'ai-provider.json')
    this.statusPath = join(this.secretDir, 'ai-provider-status.json')
    this.officialSecretPath = join(this.secretDir, 'openai-key.dpapi')
    this.legacyOfficialStatusPath = join(this.secretDir, 'openai-key-status.json')
    this.relaySecretPath = join(this.secretDir, 'relay-key.dpapi')
    this.protect = protect
    this.unprotect = unprotect
    this.env = env
  }

  async init() {
    await mkdir(this.secretDir, { recursive: true })
  }

  async loadConfig() {
    try {
      const value = JSON.parse(await readFile(this.configPath, 'utf8'))
      const relay = value.relay ? normalizeProviderConfig(value.relay) : null
      return {
        version: 1,
        activeProvider: value.activeProvider === 'relay' && relay ? 'relay' : 'openai',
        relay,
      }
    } catch { return { ...DEFAULT_CONFIG } }
  }

  async saveConfig(config) {
    const value = {
      version: 1,
      activeProvider: config.activeProvider === 'relay' && config.relay ? 'relay' : 'openai',
      relay: config.relay ? normalizeProviderConfig(config.relay) : null,
    }
    await writeFile(this.configPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    return value
  }

  async getSecret(kind) {
    const path = kind === 'relay' ? this.relaySecretPath : this.officialSecretPath
    if (existsSync(path)) {
      try {
        const value = this.unprotect(await readFile(path, 'utf8'))
        if (value) return value
      } catch { /* unreadable ciphertext is treated as absent */ }
    }
    return kind === 'openai' ? this.env.OPENAI_API_KEY || '' : ''
  }

  async saveSecret(kind, secret) {
    const path = kind === 'relay' ? this.relaySecretPath : this.officialSecretPath
    await writeFile(path, this.protect(secret), { encoding: 'utf8', mode: 0o600 })
  }

  async loadStatuses() {
    let value = {}
    try { value = JSON.parse(await readFile(this.statusPath, 'utf8')) } catch { /* first run */ }
    const statuses = {
      openai: safeStatus(value.openai),
      relay: safeStatus(value.relay),
    }
    if (!statuses.openai) {
      try {
        const legacy = JSON.parse(await readFile(this.legacyOfficialStatusPath, 'utf8'))
        statuses.openai = safeStatus({
          ...legacy,
          capabilities: {
            authentication: legacy.keyStatus === 'valid' ? 'valid' : legacy.keyStatus === 'invalid' ? 'invalid' : 'unverified',
            text: legacy.keyStatus === 'valid' ? 'responses' : 'unavailable',
            embeddings: 'not-tested',
          },
        })
      } catch { /* legacy status is optional */ }
    }
    return statuses
  }

  async saveStatus(kind, status) {
    const statuses = await this.loadStatuses()
    statuses[kind] = safeStatus(status)
    await writeFile(this.statusPath, `${JSON.stringify({ version: 1, ...statuses }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  }

  async describe() {
    const config = await this.loadConfig()
    const statuses = await this.loadStatuses()
    const officialHasKey = Boolean(await this.getSecret('openai'))
    const relayHasKey = Boolean(await this.getSecret('relay'))
    const profile = config.activeProvider === 'relay' && config.relay ? config.relay : OFFICIAL_PROFILE
    const activeHasKey = config.activeProvider === 'relay' ? relayHasKey : officialHasKey
    const activeStatus = statuses[config.activeProvider] || { keyStatus: activeHasKey ? 'unverified' : 'missing', capabilities: { authentication: 'unverified', text: 'unavailable', embeddings: 'not-tested' }, models: [], canActivate: true }
    return {
      activeProvider: config.activeProvider,
      hasApiKey: activeHasKey,
      keyStatus: activeHasKey ? activeStatus.keyStatus : 'missing',
      validatedAt: activeStatus.validatedAt,
      answerModel: profile.textModel,
      embeddingModel: profile.embeddingModel || '',
      capabilities: activeStatus.capabilities,
      providers: {
        openai: { kind: 'openai', hasApiKey: officialHasKey, status: statuses.openai || null, profile: OFFICIAL_PROFILE },
        relay: { kind: 'relay', hasApiKey: relayHasKey, status: statuses.relay || null, profile: config.relay },
      },
    }
  }

  async runtimeProfile() {
    const config = await this.loadConfig()
    const kind = config.activeProvider === 'relay' && config.relay ? 'relay' : 'openai'
    const profile = kind === 'relay' ? config.relay : OFFICIAL_PROFILE
    const apiKey = await this.getSecret(kind)
    const statuses = await this.loadStatuses()
    return { kind, profile, apiKey, status: statuses[kind] }
  }

  async removeRelay() {
    const config = await this.loadConfig()
    await this.saveConfig({ ...config, activeProvider: 'openai', relay: null })
    await unlink(this.relaySecretPath).catch((error) => { if (error?.code !== 'ENOENT') throw error })
    const statuses = await this.loadStatuses()
    statuses.relay = null
    await writeFile(this.statusPath, `${JSON.stringify({ version: 1, ...statuses }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  }
}
