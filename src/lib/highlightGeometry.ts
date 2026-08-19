export type HighlightRect = Readonly<{
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}>

export type HighlightBand = Readonly<{
  height: number
  left: number
  top: number
  width: number
}>

type HighlightLine = {
  bottom: number
  rects: HighlightRect[]
  top: number
}

const MIN_RECT_SIZE = 1
const LINE_CENTER_TOLERANCE = 1.5
const LINE_CENTER_TOLERANCE_RATIO = 0.12
const MAX_INLINE_GAP_RATIO = 0.5
const INLINE_BLEED = 1

function center(rect: Pick<HighlightRect, 'bottom' | 'top'>) {
  return (rect.top + rect.bottom) / 2
}

function isSameVisualLine(line: HighlightLine, rect: HighlightRect) {
  const lineHeight = line.bottom - line.top
  const tolerance = Math.max(
    LINE_CENTER_TOLERANCE,
    Math.min(lineHeight, rect.height) * LINE_CENTER_TOLERANCE_RATIO,
  )
  return Math.abs(center(line) - center(rect)) <= tolerance
}

function groupByVisualLine(rects: HighlightRect[]) {
  const lines: HighlightLine[] = []
  for (const rect of rects) {
    let closest: HighlightLine | undefined
    let closestDistance = Number.POSITIVE_INFINITY
    for (const line of lines) {
      if (!isSameVisualLine(line, rect)) continue
      const distance = Math.abs(center(line) - center(rect))
      if (distance < closestDistance) {
        closest = line
        closestDistance = distance
      }
    }
    if (!closest) {
      lines.push({ bottom: rect.bottom, rects: [rect], top: rect.top })
      continue
    }
    closest.rects.push(rect)
    closest.top = Math.min(closest.top, rect.top)
    closest.bottom = Math.max(closest.bottom, rect.bottom)
  }
  return lines.sort((a, b) => a.top - b.top)
}

function mergeInlineFragments(line: HighlightLine) {
  const fragments = [...line.rects].sort((a, b) => a.left - b.left)
  const merged: Array<{ left: number; right: number }> = []
  for (const rect of fragments) {
    const current = merged.at(-1)
    if (!current) {
      merged.push({ left: rect.left, right: rect.right })
      continue
    }
    const maxGap = Math.max(2, Math.min(line.bottom - line.top, rect.height) * MAX_INLINE_GAP_RATIO)
    if (rect.left - current.right <= maxGap) {
      current.right = Math.max(current.right, rect.right)
    } else {
      merged.push({ left: rect.left, right: rect.right })
    }
  }
  return merged
}

export function buildHighlightBands(rects: Iterable<HighlightRect>, layerRect: Pick<HighlightRect, 'left' | 'top'>): HighlightBand[] {
  const visibleRects = Array.from(rects)
    .filter((rect) => rect.width >= MIN_RECT_SIZE && rect.height >= MIN_RECT_SIZE)
    .sort((a, b) => a.top - b.top || a.left - b.left)

  return groupByVisualLine(visibleRects).flatMap((line) => {
    const lineHeight = line.bottom - line.top
    return mergeInlineFragments(line).map((fragment) => ({
      height: lineHeight,
      left: fragment.left - layerRect.left - INLINE_BLEED,
      top: line.top - layerRect.top,
      width: fragment.right - fragment.left + INLINE_BLEED * 2,
    }))
  })
}
