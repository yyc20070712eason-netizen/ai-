import { describe, expect, it } from 'vitest'
import { buildHighlightBands, type HighlightRect } from './highlightGeometry'

function rect(left: number, top: number, width: number, height: number): HighlightRect {
  return { bottom: top + height, height, left, right: left + width, top, width }
}

describe('highlight band geometry', () => {
  it('merges adjacent fragments with a one-pixel vertical offset', () => {
    const bands = buildHighlightBands([
      rect(110, 210, 20, 12),
      rect(131, 211, 30, 12),
      rect(163, 210, 18, 12),
    ], rect(100, 200, 200, 200))

    expect(bands).toHaveLength(1)
    expect(bands[0].left).toBe(9)
    expect(bands[0].width).toBe(73)
    expect(bands[0].top).toBe(10)
    expect(bands[0].height).toBe(13)
  })

  it('keeps separate visual lines separate', () => {
    const bands = buildHighlightBands([
      rect(10, 10, 50, 12),
      rect(10, 30, 50, 12),
    ], rect(0, 0, 100, 100))

    expect(bands).toHaveLength(2)
    expect(bands[0].top).toBeLessThan(bands[1].top)
  })

  it('does not bridge a large inline gap or separate columns', () => {
    const bands = buildHighlightBands([
      rect(10, 10, 20, 12),
      rect(45, 10, 20, 12),
    ], rect(0, 0, 100, 100))

    expect(bands).toHaveLength(2)
    expect(bands.map((band) => band.left)).toEqual([9, 44])
  })

  it('uses the full visual line height and a one-pixel inline bleed', () => {
    const regular = buildHighlightBands([rect(10, 10, 20, 20)], rect(0, 0, 100, 100))[0]
    const small = buildHighlightBands([rect(10, 10, 20, 4)], rect(0, 0, 100, 100))[0]

    expect(regular.left).toBe(9)
    expect(regular.width).toBe(22)
    expect(regular.top).toBe(10)
    expect(regular.height).toBe(20)
    expect(small.top).toBe(10)
    expect(small.height).toBe(4)
  })

  it('ignores zero-sized selection fragments', () => {
    expect(buildHighlightBands([
      rect(10, 10, 0, 12),
      rect(10, 10, 20, 0),
    ], rect(0, 0, 100, 100))).toEqual([])
  })
})
