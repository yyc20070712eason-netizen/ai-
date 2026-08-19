export type ReleaseHistoryEntry = {
  version: string
  releasedAt: string
  highlights: string[]
}

export function parseReleaseHistory(markdown: string): ReleaseHistoryEntry[]
