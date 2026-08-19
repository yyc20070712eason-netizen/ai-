export const UI_PREFERENCES_KEY = 'ai-study:ui:v3'
export const V2_UI_PREFERENCES_KEY = 'ai-study:ui:v2'
export const LEGACY_UI_PREFERENCES_KEY = 'ai-study:ui:v1'

export type UiTheme = 'dark' | 'light'

export type KnowledgeTreeViewport = {
  x: number
  y: number
  zoom: number
  canvasWidth?: number
  canvasHeight?: number
}

export type UiPreferencesV3 = {
  version: 3
  theme: UiTheme
  desktopRailOpen: boolean
  expandedChapterIds: string[]
  knowledgeTree: {
    lastExpandedChapterId: string | null
    viewports: Record<string, KnowledgeTreeViewport>
  }
}

type UiPreferencesV2 = Omit<UiPreferencesV3, 'version' | 'theme' | 'desktopRailOpen'> & { version: 2 }

const DEFAULT_UI_PREFERENCES: UiPreferencesV3 = {
  version: 3,
  theme: 'dark',
  desktopRailOpen: true,
  expandedChapterIds: [],
  knowledgeTree: {
    lastExpandedChapterId: null,
    viewports: {},
  },
}

function normalizeExpandedIds(value: unknown, validChapterIds: readonly string[]) {
  if (!Array.isArray(value)) return []
  const valid = new Set(validChapterIds)
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && valid.has(item)))]
}

function normalizeViewport(value: unknown): KnowledgeTreeViewport | null {
  if (!value || typeof value !== 'object') return null
  const viewport = value as Partial<KnowledgeTreeViewport>
  if (![viewport.x, viewport.y, viewport.zoom].every((item) => typeof item === 'number' && Number.isFinite(item))) return null
  if (viewport.zoom! < 0.25 || viewport.zoom! > 1.5) return null
  const canvasWidth = typeof viewport.canvasWidth === 'number' && Number.isFinite(viewport.canvasWidth) && viewport.canvasWidth > 0
    ? viewport.canvasWidth
    : undefined
  const canvasHeight = typeof viewport.canvasHeight === 'number' && Number.isFinite(viewport.canvasHeight) && viewport.canvasHeight > 0
    ? viewport.canvasHeight
    : undefined
  return { x: viewport.x!, y: viewport.y!, zoom: viewport.zoom!, ...(canvasWidth ? { canvasWidth } : {}), ...(canvasHeight ? { canvasHeight } : {}) }
}

function normalizeTree(tree: UiPreferencesV3['knowledgeTree'] | undefined, validChapterIds: readonly string[]) {
  const source = tree && typeof tree === 'object' ? tree : DEFAULT_UI_PREFERENCES.knowledgeTree
  const valid = new Set(validChapterIds)
  const viewports = Object.fromEntries(Object.entries(source.viewports ?? {})
    .filter(([key, value]) => (key === 'global' || valid.has(key)) && normalizeViewport(value))
    .map(([key, value]) => [key, normalizeViewport(value)!]))
  return {
    lastExpandedChapterId: typeof source.lastExpandedChapterId === 'string' && valid.has(source.lastExpandedChapterId)
      ? source.lastExpandedChapterId
      : null,
    viewports,
  }
}

function parseV3(raw: string, validChapterIds: readonly string[]): UiPreferencesV3 | null {
  const parsed = JSON.parse(raw) as Partial<UiPreferencesV3>
  if (parsed.version !== 3) return null
  return {
    version: 3,
    theme: parsed.theme === 'light' ? 'light' : 'dark',
    desktopRailOpen: parsed.desktopRailOpen !== false,
    expandedChapterIds: normalizeExpandedIds(parsed.expandedChapterIds, validChapterIds),
    knowledgeTree: normalizeTree(parsed.knowledgeTree, validChapterIds),
  }
}

function parseV2(raw: string, validChapterIds: readonly string[]): UiPreferencesV3 | null {
  const parsed = JSON.parse(raw) as Partial<UiPreferencesV2>
  if (parsed.version !== 2) return null
  return {
    ...DEFAULT_UI_PREFERENCES,
    expandedChapterIds: normalizeExpandedIds(parsed.expandedChapterIds, validChapterIds),
    knowledgeTree: normalizeTree(parsed.knowledgeTree, validChapterIds),
  }
}

export function loadUiPreferences(validChapterIds: readonly string[]): UiPreferencesV3 {
  try {
    const current = localStorage.getItem(UI_PREFERENCES_KEY)
    if (current) return parseV3(current, validChapterIds) ?? DEFAULT_UI_PREFERENCES
    const v2 = localStorage.getItem(V2_UI_PREFERENCES_KEY)
    if (v2) return parseV2(v2, validChapterIds) ?? DEFAULT_UI_PREFERENCES
    const legacy = localStorage.getItem(LEGACY_UI_PREFERENCES_KEY)
    if (!legacy) return DEFAULT_UI_PREFERENCES
    const parsed = JSON.parse(legacy) as { version?: number, expandedChapterIds?: unknown }
    if (parsed.version !== 1) return DEFAULT_UI_PREFERENCES
    return {
      ...DEFAULT_UI_PREFERENCES,
      expandedChapterIds: normalizeExpandedIds(parsed.expandedChapterIds, validChapterIds),
    }
  } catch {
    return DEFAULT_UI_PREFERENCES
  }
}

function writePreferences(preferences: UiPreferencesV3) {
  try {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // UI preferences are optional; learning data remains unaffected when storage is unavailable.
  }
}

export function saveUiPreferences(expandedChapterIds: Iterable<string>, validChapterIds: readonly string[]) {
  const current = loadUiPreferences(validChapterIds)
  writePreferences({
    ...current,
    expandedChapterIds: normalizeExpandedIds([...expandedChapterIds], validChapterIds),
  })
}

export function saveThemePreference(theme: UiTheme, validChapterIds: readonly string[]) {
  writePreferences({ ...loadUiPreferences(validChapterIds), theme })
}

export function saveDesktopRailPreference(desktopRailOpen: boolean, validChapterIds: readonly string[]) {
  writePreferences({ ...loadUiPreferences(validChapterIds), desktopRailOpen })
}

export function saveKnowledgeTreePreferences(
  validChapterIds: readonly string[],
  expandedChapterId: string | null,
  viewportKey: string,
  viewport?: KnowledgeTreeViewport,
) {
  const current = loadUiPreferences(validChapterIds)
  const valid = new Set(validChapterIds)
  writePreferences({
    ...current,
    knowledgeTree: {
      lastExpandedChapterId: expandedChapterId && valid.has(expandedChapterId)
        ? expandedChapterId
        : current.knowledgeTree.lastExpandedChapterId,
      viewports: viewport && (viewportKey === 'global' || valid.has(viewportKey))
        ? { ...current.knowledgeTree.viewports, [viewportKey]: viewport }
        : current.knowledgeTree.viewports,
    },
  })
}
