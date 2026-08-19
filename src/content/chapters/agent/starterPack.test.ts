import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd(), 'public', 'practice', 'agent-blueprint')
const files = [
  'README.md', 'package.json', '01-system-map.md', 'action-contract.json', '02-execution-plan.md',
  'state-and-tools.json', '03-reliability.md', 'routing-and-handoff.json', '04-implementation.md',
  'eval-cases.json', '05-assistant-spec.md', 'intent-schema.json', 'iteration-report.md', 'tests/blueprint.test.mjs',
]

describe('Agent starter pack', () => {
  it('ships every declared artifact and a dependency-free Node test suite', () => {
    expect(files.every((file) => existsSync(resolve(root, file)))).toBe(true)
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    expect(packageJson).toMatchObject({ private: true, type: 'module', scripts: { test: 'node --test' } })
    expect(packageJson.dependencies).toBeUndefined()
    const tests = readFileSync(resolve(root, 'tests', 'blueprint.test.mjs'), 'utf8')
    for (let milestone = 1; milestone <= 5; milestone += 1) expect(tests).toContain(`milestone ${milestone}`)
    expect(tests).not.toMatch(/https?:\/\//u)
  })

  it('includes the downloadable ZIP without credentials or real service calls', () => {
    const zip = resolve(root, '..', 'agent-blueprint-starter.zip')
    expect(existsSync(zip)).toBe(true)
    expect(statSync(zip).size).toBeGreaterThan(1_000)
    const combined = files.map((file) => readFileSync(resolve(root, file), 'utf8')).join('\n')
    expect(combined).not.toMatch(/sk-[A-Za-z0-9_-]{12,}/u)
    expect(combined).not.toContain('Cookie:')
  })
})
