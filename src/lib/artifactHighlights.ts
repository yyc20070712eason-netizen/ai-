import type { ArtifactColor, LearningArtifact } from '../types'
import { buildHighlightBands } from './highlightGeometry'
import { findTextRange } from './textAnchors'

function artifactColor(artifact: LearningArtifact): ArtifactColor {
  return artifact.color ?? (artifact.type === 'annotation' ? 'blue' : 'yellow')
}

export function renderArtifactHighlights(root: HTMLElement | null, layer: HTMLElement | null, artifacts: LearningArtifact[]) {
  if (!root || !layer) return
  layer.replaceChildren()
  const layerRect = layer.getBoundingClientRect()
  for (const artifact of artifacts) {
    if (artifact.anchor.kind !== 'document' || artifact.needsRelocation) continue
    const range = findTextRange(root, artifact.anchor.quote, artifact.anchor.start)
    if (!range) continue
    const bands = buildHighlightBands(Array.from(range.getClientRects()), layerRect)
    bands.forEach((band, index) => {
      const mark = document.createElement('span')
      mark.className = `source-artifact-mark is-${artifact.type} is-${artifactColor(artifact)}${index === 0 ? ' is-first-fragment' : ''}`
      mark.dataset.artifactId = artifact.id
      mark.style.left = `${band.left}px`
      mark.style.top = `${band.top}px`
      mark.style.width = `${band.width}px`
      mark.style.height = `${band.height}px`
      layer.append(mark)
    })
  }
}
