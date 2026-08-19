import { describe, expect, it } from 'vitest'
import { clientRelease, releaseLabel } from './release'
import { STUDY_STATE_VERSION } from './lib/study'
import { ARCHIVE_VERSION } from './lib/studyArchive'
import manifest from '../release.json'
import packageJson from '../package.json'

describe('release metadata', () => {
  it('keeps the manifest, package and compiled client version aligned', () => {
    expect(clientRelease.version).toBe(manifest.version)
    expect(packageJson.version).toBe(manifest.version)
    expect(clientRelease.apiVersion).toBe(manifest.apiVersion)
    expect(clientRelease.dataSchemaVersion).toBe(ARCHIVE_VERSION)
    expect(STUDY_STATE_VERSION).toBe(5)
    expect(clientRelease.buildId).toMatch(new RegExp(`^${manifest.version.replaceAll('.', '\\.')}\\+`))
  })

  it('exposes a restrained user-facing label and non-empty release notes', () => {
    expect(releaseLabel(clientRelease)).toBe(`v${manifest.version}`)
    expect(clientRelease.highlights.length).toBeGreaterThan(0)
    expect(clientRelease.highlights.every((item) => item.trim().length > 0)).toBe(true)
    expect(clientRelease.history.length).toBeGreaterThan(10)
    expect(clientRelease.history[0]).toMatchObject({
      version: manifest.version,
      releasedAt: manifest.releasedAt,
      highlights: manifest.highlights,
    })
    expect(new Set(clientRelease.history.map((entry) => entry.version)).size).toBe(clientRelease.history.length)
  })
})
