import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

const cleanups = []

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()()
})

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

async function unusedPort() {
  const server = createServer()
  const port = await listen(server)
  await close(server)
  return port
}

async function waitFor(url, child) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`本地服务提前退出：${child.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.status < 500) return
    } catch { /* startup in progress */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('本地服务启动超时')
}

async function request(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json()
  return { response, body }
}

describe('provider HTTP API', () => {
  it('persists a text-only Chat relay, keeps ciphertext private, and removes it independently', async () => {
    const relay = createServer(async (req, res) => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const authorized = req.headers.authorization === 'Bearer relay-token'
      res.setHeader('Content-Type', 'application/json')
      if (!authorized) {
        res.statusCode = 401
        res.end(JSON.stringify({ error: { message: 'denied' } }))
      } else if (req.url === '/v1/chat/completions') {
        res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
      } else {
        res.statusCode = 404
        res.end(JSON.stringify({ error: { message: 'not implemented' } }))
      }
    })
    const relayPort = await listen(relay)
    cleanups.push(() => close(relay))

    const dataDir = await mkdtemp(join(tmpdir(), 'ai-study-provider-api-'))
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }))
    const appPort = await unusedPort()
    const child = spawn(process.execPath, ['server/index.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, AI_STUDY_PORT: String(appPort), AI_STUDY_DATA_DIR: dataDir, OPENAI_API_KEY: '' },
      stdio: 'ignore',
    })
    cleanups.push(async () => {
      if (child.exitCode !== null) return
      child.kill()
      await new Promise((resolve) => child.once('exit', resolve))
    })
    const app = `http://127.0.0.1:${appPort}`
    await waitFor(`${app}/api/version`, child)

    const input = {
      kind: 'relay',
      apiKey: 'relay-token',
      activate: true,
      profile: {
        baseUrl: `http://127.0.0.1:${relayPort}`,
        textApi: 'auto',
        textModel: 'relay-chat',
        embeddingMode: 'auto',
        embeddingModel: 'relay-embedding',
      },
    }
    const tested = await request(app, '/api/config/provider/test', { method: 'POST', body: JSON.stringify(input) })
    expect(tested.response.status).toBe(200)
    expect(tested.body.result).toMatchObject({ keyStatus: 'valid', capabilities: { text: 'chat-completions', embeddings: 'unavailable' } })

    const saved = await request(app, '/api/config/provider', { method: 'PUT', body: JSON.stringify(input) })
    expect(saved.response.status).toBe(200)
    expect(saved.body.config).toMatchObject({ activeProvider: 'relay', hasApiKey: true, answerModel: 'relay-chat' })
    const configText = await readFile(join(dataDir, 'secrets', 'ai-provider.json'), 'utf8')
    const cipherText = await readFile(join(dataDir, 'secrets', 'relay-key.dpapi'), 'utf8')
    expect(`${configText}${cipherText}`).not.toContain('relay-token')

    const status = await request(app, '/api/config/status')
    expect(status.body).toMatchObject({ activeProvider: 'relay', keyStatus: 'valid', capabilities: { text: 'chat-completions', embeddings: 'unavailable' } })

    const removed = await request(app, '/api/config/provider/relay', { method: 'DELETE', body: '{}' })
    expect(removed.response.status).toBe(200)
    expect(removed.body.config).toMatchObject({ activeProvider: 'openai', hasApiKey: false })
  }, 25_000)
})
