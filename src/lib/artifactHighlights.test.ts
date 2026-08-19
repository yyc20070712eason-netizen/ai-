import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LearningArtifact } from '../types'
import { renderArtifactHighlights } from './artifactHighlights'

const originalGetClientRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')

const artifact = {
  id: 'artifact-1',
  chapterId: 'agent',
  stageKey: 'agent:first',
  type: 'highlight',
  color: 'yellow',
  anchor: { kind: 'document', documentId: 'document-1', page: 2, blockId: 'page-2', start: 0, end: 6, quote: 'Agent鍒ゆ柇' },
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
} satisfies LearningArtifact

describe('artifact highlight rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    if (originalGetClientRects) Object.defineProperty(Range.prototype, 'getClientRects', originalGetClientRects)
    else Reflect.deleteProperty(Range.prototype, 'getClientRects')
  })

  it('renders merged full-line marks with the persisted artifact identity', () => {
    const root = document.createElement('div')
    root.textContent = artifact.anchor.quote
    const layer = document.createElement('div')
    vi.spyOn(layer, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200 } as DOMRect)
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [
        { bottom: 222, height: 12, left: 110, right: 130, top: 210, width: 20 },
        { bottom: 223, height: 12, left: 131, right: 161, top: 211, width: 30 },
      ],
    })

    renderArtifactHighlights(root, layer, [artifact])

    expect(layer.children).toHaveLength(1)
    const mark = layer.firstElementChild as HTMLElement
    expect(mark).toHaveClass('source-artifact-mark', 'is-highlight', 'is-yellow', 'is-first-fragment')
    expect(mark.dataset.artifactId).toBe(artifact.id)
    expect(mark.style.left).toBe('9px')
    expect(Number.parseFloat(mark.style.height)).toBe(13)
  })

  it('keeps annotations identifiable and skips relocation records', () => {
    const root = document.createElement('div')
    root.textContent = artifact.anchor.quote
    const layer = document.createElement('div')
    vi.spyOn(layer, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect)
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [{ bottom: 22, height: 12, left: 10, right: 30, top: 10, width: 20 }],
    })

    renderArtifactHighlights(root, layer, [
      { ...artifact, id: 'annotation-1', type: 'annotation', color: 'blue' },
      { ...artifact, id: 'pending-1', needsRelocation: true },
    ])

    expect(layer.children).toHaveLength(1)
    expect(layer.firstElementChild).toHaveClass('is-annotation', 'is-blue', 'is-first-fragment')
  })
})
