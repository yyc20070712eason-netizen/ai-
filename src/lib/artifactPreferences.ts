import type { ArtifactColor } from '../types'

export const ARTIFACT_COLORS_KEY = 'ai-study:artifact-colors:v1'
export const ANNOTATION_DRAFTS_KEY = 'ai-study:annotation-drafts:v1'
export const ARTIFACT_COLORS: ArtifactColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']

type ColorPreferences = { version: 1, highlight: ArtifactColor, annotation: ArtifactColor }
export type AnnotationDraft = { note: string, color: ArtifactColor, artifactId?: string }
const defaults: ColorPreferences = { version: 1, highlight: 'yellow', annotation: 'blue' }

function isColor(value: unknown): value is ArtifactColor {
  return typeof value === 'string' && ARTIFACT_COLORS.includes(value as ArtifactColor)
}

export function loadArtifactColorPreferences(): ColorPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(ARTIFACT_COLORS_KEY) ?? '')
    return { version: 1, highlight: isColor(value.highlight) ? value.highlight : defaults.highlight, annotation: isColor(value.annotation) ? value.annotation : defaults.annotation }
  } catch { return defaults }
}

export function saveArtifactColorPreference(type: 'highlight' | 'annotation', color: ArtifactColor) {
  const preferences = loadArtifactColorPreferences()
  preferences[type] = color
  try { localStorage.setItem(ARTIFACT_COLORS_KEY, JSON.stringify(preferences)) } catch { /* optional UI preference */ }
}

function loadDrafts(): Record<string, AnnotationDraft> {
  try { return JSON.parse(localStorage.getItem(ANNOTATION_DRAFTS_KEY) ?? '{}') as Record<string, AnnotationDraft> } catch { return {} }
}

export function readAnnotationDraft(key: string) { return loadDrafts()[key] }
export function saveAnnotationDraft(key: string, draft: AnnotationDraft) {
  try { localStorage.setItem(ANNOTATION_DRAFTS_KEY, JSON.stringify({ ...loadDrafts(), [key]: draft })) } catch { /* retry remains in memory */ }
}
export function clearAnnotationDraft(key: string) {
  const drafts = loadDrafts()
  delete drafts[key]
  try { localStorage.setItem(ANNOTATION_DRAFTS_KEY, JSON.stringify(drafts)) } catch { /* optional fallback */ }
}
