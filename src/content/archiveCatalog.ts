import catalog from '../../shared/archive-catalog.json'
import type { ArchiveCatalogEntry } from '../types'

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const ARCHIVE_CHAPTER_ID = 'archive'
export const ARCHIVE_CATALOG = catalog.items
  .map((item) => ({ ...item } as ArchiveCatalogEntry))
  .sort((left, right) => left.order - right.order)

export function validateArchiveCatalog(items: ArchiveCatalogEntry[] = ARCHIVE_CATALOG) {
  if (items.length !== 7) throw new Error(`归档清单必须恰好包含 7 项，当前为 ${items.length} 项。`)
  const ids = new Set<string>()
  const urls = new Set<string>()
  for (const item of items) {
    if (!ID_PATTERN.test(item.id) || ids.has(item.id)) throw new Error(`归档 ID 无效或重复：${item.id}`)
    if (!item.title.trim() || !item.aliases.length) throw new Error(`归档条目内容不完整：${item.id}`)
    const url = new URL(item.url)
    const isFeishuDocument = url.protocol === 'https:' && !url.username && !url.password && /(?:^|\.)feishu\.cn$/.test(url.hostname)
    if (!isFeishuDocument || urls.has(item.url)) throw new Error(`归档链接无效或重复：${item.id}`)
    ids.add(item.id)
    urls.add(item.url)
  }
  return true
}

function normalized(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function matchArchiveFile(fileName: string) {
  const name = normalized(fileName)
  const candidates = ARCHIVE_CATALOG.map((item) => {
    const score = Math.max(0, ...[item.title, item.id, ...item.aliases].map((alias) => {
      const key = normalized(alias)
      return key.length >= 3 && (name.includes(key) || key.includes(name)) ? key.length : 0
    }))
    return { item, score, coverage: score / Math.max(1, name.length) }
  }).filter((candidate) => candidate.score > 0 && candidate.coverage >= 0.6)
    .sort((left, right) => right.score - left.score)
  return candidates.length && (candidates.length === 1 || candidates[0].score > candidates[1].score)
    ? candidates[0].item
    : null
}

validateArchiveCatalog()
