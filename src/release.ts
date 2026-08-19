export type ClientRelease = {
  version: string
  channel: 'stable' | 'beta' | 'alpha'
  releasedAt: string
  apiVersion: number
  dataSchemaVersion: number
  highlights: string[]
  history: ReleaseHistoryEntry[]
  buildId: string
  builtAt: string
}

export type ReleaseHistoryEntry = {
  version: string
  releasedAt: string
  highlights: string[]
}

export const clientRelease = __APP_RELEASE__

export function releaseLabel(release: Pick<ClientRelease, 'version' | 'channel'>) {
  return `v${release.version}${release.channel === 'stable' ? '' : ` ${release.channel}`}`
}
