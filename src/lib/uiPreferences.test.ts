import { beforeEach, describe, expect, it } from 'vitest'
import {
  LEGACY_UI_PREFERENCES_KEY,
  loadUiPreferences,
  saveDesktopRailPreference,
  saveKnowledgeTreePreferences,
  saveThemePreference,
  saveUiPreferences,
  UI_PREFERENCES_KEY,
  V2_UI_PREFERENCES_KEY,
} from './uiPreferences'

const validIds = ['agent', 'rag', 'langgraph']

describe('UI preferences', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to the dark v5.1 workbench with the desktop rail open', () => {
    expect(loadUiPreferences(validIds)).toEqual({
      version: 3,
      theme: 'dark',
      desktopRailOpen: true,
      expandedChapterIds: [],
      knowledgeTree: { lastExpandedChapterId: null, viewports: {} },
    })
  })

  it('migrates v1 and v2 data while keeping the new visual preferences stable', () => {
    localStorage.setItem(LEGACY_UI_PREFERENCES_KEY, JSON.stringify({ version: 1, expandedChapterIds: ['agent', 'removed', 'agent'] }))
    expect(loadUiPreferences(validIds)).toMatchObject({ version: 3, theme: 'dark', desktopRailOpen: true, expandedChapterIds: ['agent'] })

    localStorage.clear()
    localStorage.setItem(V2_UI_PREFERENCES_KEY, JSON.stringify({
      version: 2,
      expandedChapterIds: ['rag'],
      knowledgeTree: { lastExpandedChapterId: 'rag', viewports: { rag: { x: 1, y: 2, zoom: 1 } } },
    }))
    expect(loadUiPreferences(validIds)).toEqual({
      version: 3,
      theme: 'dark',
      desktopRailOpen: true,
      expandedChapterIds: ['rag'],
      knowledgeTree: { lastExpandedChapterId: 'rag', viewports: { rag: { x: 1, y: 2, zoom: 1 } } },
    })
  })

  it('persists visual preferences without overwriting tree data or legacy expansion state', () => {
    saveKnowledgeTreePreferences(validIds, 'rag', 'rag', { x: 10, y: 20, zoom: 0.8, canvasWidth: 960, canvasHeight: 720 })
    saveUiPreferences(new Set(['agent', 'rag']), validIds)
    saveThemePreference('light', validIds)
    saveDesktopRailPreference(false, validIds)
    expect(loadUiPreferences(validIds)).toEqual({
      version: 3,
      theme: 'light',
      desktopRailOpen: false,
      expandedChapterIds: ['agent', 'rag'],
      knowledgeTree: { lastExpandedChapterId: 'rag', viewports: { rag: { x: 10, y: 20, zoom: 0.8, canvasWidth: 960, canvasHeight: 720 } } },
    })
  })

  it('normalizes damaged v3 values and ignores invalid stored data', () => {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
      version: 3,
      theme: 'violet',
      desktopRailOpen: 'no',
      expandedChapterIds: ['agent', 'removed', 'agent', 7],
      knowledgeTree: {
        lastExpandedChapterId: 'removed',
        viewports: { agent: { x: 1, y: 2, zoom: 0.75 }, removed: { x: 1, y: 2, zoom: 1 }, rag: { x: 1, y: 2, zoom: 99 } },
      },
    }))
    expect(loadUiPreferences(validIds)).toEqual({
      version: 3,
      theme: 'dark',
      desktopRailOpen: true,
      expandedChapterIds: ['agent'],
      knowledgeTree: { lastExpandedChapterId: null, viewports: { agent: { x: 1, y: 2, zoom: 0.75 } } },
    })

    localStorage.setItem(UI_PREFERENCES_KEY, '{broken')
    expect(loadUiPreferences(validIds).expandedChapterIds).toEqual([])
  })
})
