type TextPoint = { node: Text; offset: number; rawOffset: number }

type CanonicalOffset = { end: number; start: number }

export type UniqueTextAnchor = Readonly<{ end: number; start: number }>

function canonicalCharacters(value: string) {
  return [...value.normalize('NFKC')].filter((character) => {
    const code = character.codePointAt(0) ?? 0
    return !/\s/u.test(character) && code >= 32 && code !== 127
  })
}

export function canonicalAnchorText(value: string) {
  return canonicalCharacters(value).join('')
}

function canonicalTextWithOffsets(value: string) {
  const offsets: CanonicalOffset[] = []
  let canonical = ''
  for (let offset = 0; offset < value.length;) {
    const character = String.fromCodePoint(value.codePointAt(offset) ?? 0)
    const end = offset + character.length
    for (const normalized of canonicalCharacters(character)) {
      canonical += normalized
      offsets.push({ start: offset, end })
    }
    offset = end
  }
  return { canonical, offsets }
}

/**
 * Finds a quote only when its PDF-normalized form occurs exactly once.
 * The returned range is expressed in the original string's UTF-16 offsets,
 * so callers can safely persist it without changing the stored quote.
 */
export function findUniqueTextAnchor(value: string, quote: string): UniqueTextAnchor | null {
  const target = canonicalAnchorText(quote)
  if (!target) return null
  const { canonical, offsets } = canonicalTextWithOffsets(value)
  const first = canonical.indexOf(target)
  if (first < 0 || canonical.indexOf(target, first + 1) >= 0) return null
  const start = offsets[first]
  const end = offsets[first + target.length - 1]
  return start && end ? { start: start.start, end: end.end } : null
}

export function findTextRange(root: HTMLElement, quote: string, preferredStart?: number) {
  const document = root.ownerDocument
  const showText = document.defaultView?.NodeFilter.SHOW_TEXT ?? 4
  const walker = document.createTreeWalker(root, showText)
  const points: TextPoint[] = []
  let value = ''
  let rawOffset = 0

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text
    const raw = textNode.data
    for (let offset = 0; offset < raw.length;) {
      const codePoint = raw.codePointAt(offset)
      const rawCharacter = String.fromCodePoint(codePoint ?? 0)
      const length = rawCharacter.length
      for (const character of canonicalCharacters(rawCharacter)) {
        value += character
        points.push({ node: textNode, offset, rawOffset })
      }
      offset += length
      rawOffset += length
    }
  }

  const target = canonicalAnchorText(quote)
  if (!target || !value.includes(target)) return null

  const matches: number[] = []
  for (let index = value.indexOf(target); index >= 0; index = value.indexOf(target, index + 1)) matches.push(index)
  const startIndex = preferredStart === undefined
    ? matches[0]
    : matches.reduce((best, candidate) => (
      Math.abs(points[candidate].rawOffset - preferredStart) < Math.abs(points[best].rawOffset - preferredStart)
        ? candidate
        : best
    ))
  const start = points[startIndex]
  const end = points[startIndex + target.length - 1]
  if (!start || !end) return null

  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset + String.fromCodePoint(end.node.data.codePointAt(end.offset) ?? 0).length)
  return range
}
