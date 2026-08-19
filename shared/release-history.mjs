const RELEASE_HEADING = /^##\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\s+[—-]\s+(\d{4}-\d{2}-\d{2})\s*$/

export function parseReleaseHistory(markdown) {
  const history = []
  let current = null

  for (const rawLine of String(markdown).split(/\r?\n/)) {
    const line = rawLine.trim()
    const heading = line.match(RELEASE_HEADING)
    if (heading) {
      current = { version: heading[1], releasedAt: heading[2], highlights: [] }
      history.push(current)
      continue
    }

    if (current && line.startsWith('- ')) {
      const highlight = line.slice(2).trim()
      if (highlight) current.highlights.push(highlight)
    }
  }

  return history.filter((entry) => entry.highlights.length > 0)
}
