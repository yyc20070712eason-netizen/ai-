import { beforeEach, describe, expect, it } from 'vitest'
import { ANNOTATION_DRAFTS_KEY, ARTIFACT_COLORS_KEY, clearAnnotationDraft, loadArtifactColorPreferences, readAnnotationDraft, saveAnnotationDraft, saveArtifactColorPreference } from './artifactPreferences'

describe('artifact color preferences and annotation drafts', () => {
  beforeEach(() => localStorage.clear())

  it('defaults by artifact type and persists last selected colors', () => {
    expect(loadArtifactColorPreferences()).toMatchObject({ highlight: 'yellow', annotation: 'blue' })
    saveArtifactColorPreference('highlight', 'pink')
    saveArtifactColorPreference('annotation', 'purple')
    expect(JSON.parse(localStorage.getItem(ARTIFACT_COLORS_KEY)!)).toMatchObject({ highlight: 'pink', annotation: 'purple' })
  })

  it('keeps drafts until SQLite persistence confirms success', () => {
    saveAnnotationDraft('document:1:0:2', { note: '待同步批注', color: 'blue' })
    expect(readAnnotationDraft('document:1:0:2')).toMatchObject({ note: '待同步批注' })
    clearAnnotationDraft('document:1:0:2')
    expect(localStorage.getItem(ANNOTATION_DRAFTS_KEY)).toBe('{}')
  })
})
