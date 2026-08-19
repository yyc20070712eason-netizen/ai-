import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export const MAX_PDF_BYTES = 100 * 1024 * 1024
export const MAX_TEXT_DOCUMENT_BYTES = 50 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = MAX_PDF_BYTES
export const DOCUMENT_KINDS = new Set(['pdf', 'markdown', 'html'])
const ARTIFACT_COLORS = new Set(['yellow', 'green', 'blue', 'pink', 'purple'])

function artifactColor(type, color) {
  return ARTIFACT_COLORS.has(color) ? color : type === 'annotation' ? 'blue' : 'yellow'
}

export function decorateDocumentVersions(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.chapterId}:${row.sourceId}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  const versions = new Map()
  for (const group of groups.values()) {
    group.sort((left, right) => left.importedAt.localeCompare(right.importedAt) || left.id.localeCompare(right.id))
    group.forEach((row, index) => versions.set(row.id, { versionNumber: index + 1, isLatest: index === group.length - 1 }))
  }
  return rows.map((row) => ({ ...row, indexed: Boolean(row.indexed), ...(versions.get(row.id) ?? { versionNumber: 1, isLatest: true }) }))
}

const HTML_POLICY = {
  allowedTags: ['article', 'section', 'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'strong', 'em', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br'],
  allowedAttributes: { a: ['href', 'title'] },
  allowedSchemes: ['http', 'https'],
  disallowedTagsMode: 'discard',
}

export function cleanHtml(value) {
  return sanitizeHtml(value, HTML_POLICY)
}

export function htmlToText(value) {
  return cleanHtml(value)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|blockquote|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizePdfText(value) {
  const withoutControls = [...value.normalize('NFKC')].filter((character) => {
    const code = character.codePointAt(0) ?? 0
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
  }).join('')
  return withoutControls
    .replace(/\r\n?/g, '\n')
    .replace(/([\p{Script=Han}])[ \t]+(?=[\p{Script=Han}\p{P}])/gu, '$1')
    .replace(/([\p{P}])[ \t]+(?=\p{Script=Han})/gu, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function pdfItemsToText(items) {
  let value = ''
  for (const item of items) {
    if (!item || !('str' in item) || !item.str) continue
    const text = String(item.str)
    const previous = value.at(-1) || ''
    const first = text.at(0) || ''
    if (value && !value.endsWith('\n') && /[A-Za-z0-9）)\]}]/.test(previous) && /^[A-Za-z0-9（([{]/.test(first)) value += ' '
    value += text
    if (item.hasEOL) value += '\n'
  }
  return normalizePdfText(value)
}

async function extractPdfPages(bytes) {
  const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
  const pdf = await loadingTask.promise
  const pages = []
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push({ page: pageNumber, text: pdfItemsToText(content.items) })
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }
  return pages
}

export function splitIntoChunks(text, page = 1, section = '') {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
  if (!normalized) return []
  const chunks = []
  const size = 700
  const overlap = 100
  for (let start = 0, ordinal = 0; start < normalized.length; start += size - overlap, ordinal += 1) {
    let end = Math.min(start + size, normalized.length)
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n', end), normalized.lastIndexOf('。', end))
      if (boundary > start + 350) end = boundary + 1
    }
    const body = normalized.slice(start, end).trim()
    if (body) chunks.push({ ordinal, page, section, body })
    if (end >= normalized.length) break
    start = end - (size - overlap)
  }
  return chunks
}

export function toSearchText(text) {
  const bigrams = []
  for (const match of text.matchAll(/[\u3400-\u9fff]{2,}/g)) {
    const run = match[0]
    for (let index = 0; index < run.length - 1; index += 1) bigrams.push(run.slice(index, index + 2))
  }
  return `${text} ${bigrams.join(' ')}`
}

function vectorToBuffer(vector) {
  return Buffer.from(new Float32Array(vector).buffer)
}

function bufferToVector(buffer) {
  if (!buffer) return null
  return new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 4))
}

export function cosineSimilarity(left, right) {
  if (!left || !right || left.length !== right.length) return 0
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] ** 2
    rightNorm += right[index] ** 2
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0
}

export class WorkspaceStore {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.documentsDir = join(rootDir, 'documents')
    this.db = null
  }

  async init() {
    await mkdir(this.documentsDir, { recursive: true })
    this.db = new DatabaseSync(join(this.rootDir, 'workspace.sqlite'))
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, source_id TEXT NOT NULL,
        name TEXT NOT NULL, kind TEXT NOT NULL, size INTEGER NOT NULL,
        checksum TEXT NOT NULL, page_count INTEGER NOT NULL, chunk_count INTEGER NOT NULL,
        indexed INTEGER NOT NULL DEFAULT 0, imported_at TEXT NOT NULL,
        file_path TEXT NOT NULL, rendered_html TEXT NOT NULL DEFAULT '',
        extraction_version INTEGER NOT NULL DEFAULT 2
      );
      CREATE UNIQUE INDEX IF NOT EXISTS documents_unique_source ON documents(chapter_id, source_id, checksum);
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL, page INTEGER, section TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL, embedding BLOB
      );
      CREATE TABLE IF NOT EXISTS document_pages (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        page INTEGER NOT NULL, body TEXT NOT NULL,
        PRIMARY KEY(document_id, page)
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(chunk_id UNINDEXED, document_id UNINDEXED, search_text, tokenize='unicode61');
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, stage_key TEXT,
        type TEXT NOT NULL, anchor_json TEXT NOT NULL, note TEXT, color TEXT,
        needs_relocation INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_answers (
        id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, stage_key TEXT,
        question TEXT NOT NULL, answer TEXT NOT NULL, confidence TEXT NOT NULL,
        citations_json TEXT NOT NULL, followups_json TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY, scope TEXT NOT NULL, target_key TEXT NOT NULL,
        title TEXT NOT NULL, body TEXT NOT NULL, citations_json TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
        generated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS archive_states (
        source_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );
    `)
    const documentColumns = this.db.prepare('PRAGMA table_info(documents)').all()
    if (!documentColumns.some((column) => column.name === 'extraction_version')) {
      this.db.exec('ALTER TABLE documents ADD COLUMN extraction_version INTEGER NOT NULL DEFAULT 1')
    }
    const artifactColumns = this.db.prepare('PRAGMA table_info(artifacts)').all()
    if (!artifactColumns.some((column) => column.name === 'color')) this.db.exec('ALTER TABLE artifacts ADD COLUMN color TEXT')
    await this.reindexLegacyPdfDocuments()
  }

  close() {
    this.db?.close()
    this.db = null
  }

  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = callback()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  listDocuments(chapterId) {
    const rows = this.db.prepare(`SELECT id, chapter_id AS chapterId, source_id AS sourceId, name, kind, size, checksum,
      page_count AS pageCount, chunk_count AS chunkCount, indexed, imported_at AS importedAt
      FROM documents WHERE chapter_id = ? ORDER BY imported_at DESC, id DESC`).all(chapterId)
    return decorateDocumentVersions(rows)
  }

  listArchiveStates() {
    return this.db.prepare(`SELECT source_id AS sourceId, status, note, updated_at AS updatedAt
      FROM archive_states ORDER BY source_id`).all()
  }

  setArchiveState(sourceId, status, note = '') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId)) throw new Error('归档来源 ID 无效。')
    if (!['pending', 'needs-author-action', 'failed'].includes(status)) throw new Error('归档状态无效。')
    if (typeof note !== 'string' || note.length > 1000) throw new Error('归档备注过长。')
    const updatedAt = new Date().toISOString()
    this.db.prepare(`INSERT INTO archive_states (source_id, status, note, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(source_id) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at`)
      .run(sourceId, status, note.trim(), updatedAt)
    return { sourceId, status, note: note.trim(), updatedAt }
  }

  pruneArchiveStates(allowedSourceIds) {
    const allowed = new Set(allowedSourceIds)
    const removed = []
    const preserved = []
    for (const state of this.listArchiveStates()) {
      if (allowed.has(state.sourceId)) continue
      const documentCount = this.db.prepare('SELECT COUNT(*) AS count FROM documents WHERE source_id = ?').get(state.sourceId).count
      if (documentCount > 0) {
        preserved.push(state.sourceId)
        continue
      }
      this.db.prepare('DELETE FROM archive_states WHERE source_id = ?').run(state.sourceId)
      removed.push(state.sourceId)
    }
    return { removed, preserved }
  }

  getDocument(id) {
    const row = this.db.prepare(`SELECT id, chapter_id AS chapterId, source_id AS sourceId, name, kind, size, checksum,
      page_count AS pageCount, chunk_count AS chunkCount, indexed, imported_at AS importedAt,
      file_path AS filePath, rendered_html AS renderedHtml FROM documents WHERE id = ?`).get(id)
    if (!row) return null
    const siblings = this.db.prepare(`SELECT id, chapter_id AS chapterId, source_id AS sourceId, imported_at AS importedAt
      FROM documents WHERE chapter_id = ? AND source_id = ?`).all(row.chapterId, row.sourceId)
    const version = decorateDocumentVersions(siblings).find((item) => item.id === id)
    return { ...row, indexed: Boolean(row.indexed), versionNumber: version?.versionNumber ?? 1, isLatest: version?.isLatest ?? true }
  }

  async getDocumentBytes(id) {
    const document = this.getDocument(id)
    return document ? readFile(document.filePath) : null
  }

  async deleteDocument(id) {
    const document = this.getDocument(id)
    if (!document) return false
    const transaction = () => this.transaction(() => {
      this.db.prepare('DELETE FROM chunks_fts WHERE document_id = ?').run(id)
      this.db.prepare('DELETE FROM documents WHERE id = ?').run(id)
    })
    transaction()
    await unlink(document.filePath).catch(() => undefined)
    return true
  }

  getDocumentPages(id) {
    const exactPages = this.db.prepare('SELECT page, body AS text FROM document_pages WHERE document_id = ? ORDER BY page').all(id)
    if (exactPages.length) return exactPages
    const rows = this.db.prepare('SELECT page, ordinal, body FROM chunks WHERE document_id = ? ORDER BY page, ordinal').all(id)
    const pages = new Map()
    for (const row of rows) {
      const page = row.page || 1
      const previous = pages.get(page) || ''
      if (!previous) pages.set(page, row.body)
      else {
        let overlap = Math.min(140, previous.length, row.body.length)
        while (overlap > 0 && !previous.endsWith(row.body.slice(0, overlap))) overlap -= 1
        pages.set(page, `${previous}${row.body.slice(overlap)}`)
      }
    }
    return [...pages.entries()].map(([page, text]) => ({ page, text }))
  }

  async reindexLegacyPdfDocuments() {
    const documents = this.db.prepare(`SELECT id, file_path AS filePath FROM documents
      WHERE kind = 'pdf' AND extraction_version < 2 ORDER BY imported_at`).all()
    for (const document of documents) {
      try {
        const pages = await extractPdfPages(await readFile(document.filePath))
        if (pages.some((page) => page.text.length > 20)) this.replaceDocumentText(document.id, pages)
      } catch (error) {
        console.warn(`PDF text reindex skipped for ${document.id}: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
  }

  replaceDocumentText(documentId, pages) {
    const chunks = pages.flatMap(({ page, text }) => splitIntoChunks(text, page))
    this.transaction(() => {
      this.db.prepare('DELETE FROM chunks_fts WHERE document_id = ?').run(documentId)
      this.db.prepare('DELETE FROM chunks WHERE document_id = ?').run(documentId)
      this.db.prepare('DELETE FROM document_pages WHERE document_id = ?').run(documentId)
      const insertChunk = this.db.prepare('INSERT INTO chunks (id, document_id, ordinal, page, section, body) VALUES (?, ?, ?, ?, ?, ?)')
      const insertFts = this.db.prepare('INSERT INTO chunks_fts (chunk_id, document_id, search_text) VALUES (?, ?, ?)')
      const insertPage = this.db.prepare('INSERT INTO document_pages (document_id, page, body) VALUES (?, ?, ?)')
      for (const page of pages) insertPage.run(documentId, page.page, page.text)
      for (const chunk of chunks) {
        const chunkId = randomUUID()
        insertChunk.run(chunkId, documentId, chunk.ordinal, chunk.page, chunk.section, chunk.body)
        insertFts.run(chunkId, documentId, toSearchText(chunk.body))
      }
      this.db.prepare(`UPDATE documents SET page_count = ?, chunk_count = ?, indexed = 1,
        extraction_version = 2 WHERE id = ?`).run(pages.length, chunks.length, documentId)
    })
  }

  moveDocument(id, chapterId, sourceId) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapterId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId)) throw new Error('章节或来源 ID 无效。')
    if (!this.getDocument(id)) return null
    this.db.prepare('UPDATE documents SET chapter_id = ?, source_id = ? WHERE id = ?').run(chapterId, sourceId, id)
    return this.getDocument(id)
  }

  prepareArtifactMigrations(previousDocument, documentId, pages, now) {
    if (!previousDocument) return []
    const artifacts = this.db.prepare('SELECT * FROM artifacts ORDER BY created_at').all()
      .filter((row) => {
        try {
          const anchor = JSON.parse(row.anchor_json)
          return anchor?.kind === 'document' && anchor.documentId === previousDocument.id
        } catch {
          return false
        }
      })
    if (!artifacts.length) return []

    const oldPages = new Map(this.getDocumentPages(previousDocument.id).map((page) => [page.page, page.text]))
    const contextLength = 24
    return artifacts.map((row) => {
      const anchor = JSON.parse(row.anchor_json)
      const oldText = oldPages.get(anchor.page) ?? ''
      const exactStart = oldText.slice(anchor.start, anchor.end) === anchor.quote ? anchor.start : oldText.indexOf(anchor.quote)
      const before = exactStart >= 0 ? oldText.slice(Math.max(0, exactStart - contextLength), exactStart) : ''
      const after = exactStart >= 0 ? oldText.slice(exactStart + anchor.quote.length, exactStart + anchor.quote.length + contextLength) : ''
      const matches = []
      if (anchor.quote && exactStart >= 0) {
        for (const page of pages) {
          let offset = 0
          while (offset <= page.text.length - anchor.quote.length) {
            const start = page.text.indexOf(anchor.quote, offset)
            if (start < 0) break
            const candidateBefore = page.text.slice(Math.max(0, start - before.length), start)
            const candidateAfter = page.text.slice(start + anchor.quote.length, start + anchor.quote.length + after.length)
            const contextMatches = (!before || candidateBefore === before) && (!after || candidateAfter === after)
            if (contextMatches) matches.push({ page: page.page, start })
            offset = start + Math.max(1, anchor.quote.length)
          }
        }
      }
      const match = matches.length === 1 ? matches[0] : null
      const migratedAnchor = match
        ? { ...anchor, documentId, page: match.page, blockId: `document-page-${match.page}`, start: match.start, end: match.start + anchor.quote.length }
        : { ...anchor, documentId, page: undefined, blockId: `document-${documentId}-pending`, start: 0, end: anchor.quote.length }
      return {
        id: randomUUID(),
        chapterId: row.chapter_id,
        stageKey: row.stage_key,
        type: row.type,
        anchor: migratedAnchor,
        note: row.note,
        needsRelocation: !match,
        createdAt: now,
        updatedAt: now,
      }
    })
  }

  async importDocument({ chapterId, sourceId, name, kind, bytes, embed }) {
    if (!DOCUMENT_KINDS.has(kind)) throw new Error('不支持这种文档格式。')
    const byteLimit = kind === 'pdf' ? MAX_PDF_BYTES : MAX_TEXT_DOCUMENT_BYTES
    const limitLabel = kind === 'pdf' ? '100 MB' : '50 MB'
    if (!bytes.length || bytes.length > byteLimit) throw new Error(`文档必须小于 ${limitLabel}。`)
    const checksum = createHash('sha256').update(bytes).digest('hex')
    const existing = this.db.prepare('SELECT id FROM documents WHERE chapter_id = ? AND source_id = ? AND checksum = ?').get(chapterId, sourceId, checksum)
    if (existing) return { document: this.getDocument(existing.id), migratedArtifacts: 0, relocationRequired: 0 }

    const previousDocument = this.listDocuments(chapterId).find((document) => document.sourceId === sourceId && document.isLatest) ?? null

    const id = randomUUID()
    const extension = kind === 'pdf' ? 'pdf' : kind === 'markdown' ? 'md' : 'html'
    const filePath = join(this.documentsDir, `${id}.${extension}`)
    let pages = []
    let renderedHtml = ''
    if (kind === 'pdf') {
      if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('文件内容不是有效 PDF。')
      pages = await extractPdfPages(bytes)
      if (!pages.some((page) => page.text.length > 20)) throw new Error('这份 PDF 没有可搜索文字层，第一版暂不支持扫描件 OCR。')
    } else {
      const raw = bytes.toString('utf8').replace(/^\uFEFF/, '')
      if (raw.includes('\0') || (raw.match(/�/g)?.length ?? 0) > Math.max(2, raw.length / 1000)) throw new Error('文档不是有效的 UTF-8 文本。')
      if (kind === 'html' && !/<(?:!doctype|html|head|body|article|section|h[1-6]|p|div)\b/i.test(raw)) throw new Error('文件内容不是有效 HTML。')
      renderedHtml = cleanHtml(kind === 'markdown' ? marked.parse(raw) : raw)
      const text = htmlToText(renderedHtml)
      if (!text) throw new Error('文档中没有可索引的正文。')
      pages = [{ page: 1, text }]
    }

    const chunks = pages.flatMap(({ page, text }) => splitIntoChunks(text, page))
    const chunkRecords = chunks.map((chunk) => ({ id: randomUUID(), ...chunk, embedding: null }))
    if (embed && chunkRecords.length) {
      for (let start = 0; start < chunkRecords.length; start += 64) {
        const batch = chunkRecords.slice(start, start + 64)
        const vectors = await embed(batch.map((chunk) => chunk.body))
        if (!Array.isArray(vectors) || vectors.length !== batch.length) throw new Error('向量索引返回的数据不完整。')
        batch.forEach((chunk, index) => { chunk.embedding = vectorToBuffer(vectors[index]) })
      }
    }
    const now = new Date().toISOString()
    const migrations = this.prepareArtifactMigrations(previousDocument, id, pages, now)
    const transaction = () => this.transaction(() => {
      this.db.prepare(`INSERT INTO documents
        (id, chapter_id, source_id, name, kind, size, checksum, page_count, chunk_count, indexed, imported_at, file_path, rendered_html, extraction_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)`)
        .run(id, chapterId, sourceId, name, kind, bytes.length, checksum, pages.length, chunks.length, 1, now, filePath, renderedHtml)
      const insertChunk = this.db.prepare('INSERT INTO chunks (id, document_id, ordinal, page, section, body, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)')
      const insertFts = this.db.prepare('INSERT INTO chunks_fts (chunk_id, document_id, search_text) VALUES (?, ?, ?)')
      const insertPage = this.db.prepare('INSERT INTO document_pages (document_id, page, body) VALUES (?, ?, ?)')
      const insertArtifact = this.db.prepare(`INSERT INTO artifacts
        (id, chapter_id, stage_key, type, anchor_json, note, color, needs_relocation, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      for (const page of pages) insertPage.run(id, page.page, page.text)
      for (const chunk of chunkRecords) {
        insertChunk.run(chunk.id, id, chunk.ordinal, chunk.page, chunk.section, chunk.body, chunk.embedding)
        insertFts.run(chunk.id, id, toSearchText(chunk.body))
      }
      for (const artifact of migrations) {
        insertArtifact.run(artifact.id, artifact.chapterId, artifact.stageKey ?? null, artifact.type, JSON.stringify(artifact.anchor), artifact.note ?? null, artifactColor(artifact.type, artifact.color), artifact.needsRelocation ? 1 : 0, artifact.createdAt, artifact.updatedAt)
      }
    })
    await writeFile(filePath, bytes)
    try {
      transaction()
    } catch (error) {
      await unlink(filePath).catch(() => undefined)
      throw error
    }
    return {
      document: this.getDocument(id),
      migratedArtifacts: migrations.length,
      relocationRequired: migrations.filter((artifact) => artifact.needsRelocation).length,
    }
  }

  async indexEmbeddings(documentId, embed, onlyMissing = false) {
    const chunks = this.db.prepare(`SELECT id, body FROM chunks WHERE document_id = ?${onlyMissing ? ' AND embedding IS NULL' : ''} ORDER BY ordinal`).all(documentId)
    if (!chunks.length) return 0
    for (let start = 0; start < chunks.length; start += 64) {
      const batch = chunks.slice(start, start + 64)
      const vectors = await embed(batch.map((chunk) => chunk.body))
      const update = this.db.prepare('UPDATE chunks SET embedding = ? WHERE id = ?')
      const transaction = () => this.transaction(() => batch.forEach((chunk, index) => update.run(vectorToBuffer(vectors[index]), chunk.id)))
      transaction()
    }
    this.db.prepare('UPDATE documents SET indexed = 1 WHERE id = ?').run(documentId)
    return chunks.length
  }

  async retrieve({ chapterId, query, queryEmbedding }) {
    const rows = this.db.prepare(`SELECT c.id, c.document_id AS documentId, c.ordinal, c.page, c.section, c.body, c.embedding,
      d.name AS title FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.chapter_id = ?`).all(chapterId)
    const ftsTerms = [...new Set(toSearchText(query).match(/[\p{L}\p{N}]{2,}/gu) ?? [])].slice(0, 24)
    const ftsRanks = new Map()
    if (ftsTerms.length) {
      const ftsQuery = ftsTerms.map((term) => `"${term.replaceAll('"', '""')}"`).join(' OR ')
      const hits = this.db.prepare(`SELECT f.chunk_id AS id, bm25(chunks_fts) AS rank
        FROM chunks_fts f
        JOIN chunks c ON c.id = f.chunk_id
        JOIN documents d ON d.id = c.document_id
        WHERE chunks_fts MATCH ? AND d.chapter_id = ? LIMIT 80`).all(ftsQuery, chapterId)
      hits.forEach((hit, index) => ftsRanks.set(hit.id, 1 - index / Math.max(1, hits.length)))
    }
    const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    const scored = rows.map((row) => {
      const body = row.body.toLowerCase()
      const exact = normalized && body.replace(/[^\p{L}\p{N}]+/gu, '').includes(normalized) ? 1 : 0
      const terms = [...new Set((query.match(/[\p{L}\p{N}]{2,}/gu) ?? []).flatMap((term) => term.length > 5 ? [term, ...Array.from({ length: term.length - 1 }, (_, index) => term.slice(index, index + 2))] : [term]))]
      const lexical = terms.length ? terms.filter((term) => body.includes(term.toLowerCase())).length / terms.length : 0
      const semantic = queryEmbedding ? cosineSimilarity(queryEmbedding, bufferToVector(row.embedding)) : 0
      const fts = ftsRanks.get(row.id) ?? 0
      return { ...row, embedding: undefined, score: exact * 0.15 + lexical * 0.15 + fts * 0.2 + semantic * 0.5 }
    }).filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)

    const selected = []
    for (const row of scored) {
      if (selected.some((item) => item.documentId === row.documentId && Math.abs(item.page - row.page) <= 0 && Math.abs(item.ordinal - row.ordinal) <= 1)) continue
      selected.push(row)
      if (selected.length === 6) break
    }
    return selected.map(({ id, documentId, page, section, body, title, score }) => ({ id, documentId, page, section, body, title, score }))
  }

  listArtifacts(chapterId, stageKey) {
    const rows = stageKey
      ? this.db.prepare('SELECT * FROM artifacts WHERE chapter_id = ? AND stage_key = ? ORDER BY created_at').all(chapterId, stageKey)
      : this.db.prepare('SELECT * FROM artifacts WHERE chapter_id = ? ORDER BY created_at').all(chapterId)
    return rows.map((row) => ({
      id: row.id, chapterId: row.chapter_id, stageKey: row.stage_key || undefined, type: row.type, color: artifactColor(row.type, row.color),
      anchor: JSON.parse(row.anchor_json), note: row.note || undefined, needsRelocation: Boolean(row.needs_relocation),
      createdAt: row.created_at, updatedAt: row.updated_at,
    }))
  }

  saveArtifact(value) {
    const now = new Date().toISOString()
    let id = value.id
    if (!id && value.anchor?.kind === 'document') {
      const duplicate = this.listArtifacts(value.chapterId).find((artifact) => artifact.type === value.type
        && artifact.anchor.kind === 'document'
        && artifact.anchor.documentId === value.anchor.documentId
        && artifact.anchor.page === value.anchor.page
        && artifact.anchor.quote === value.anchor.quote)
      id = duplicate?.id
    }
    id ||= randomUUID()
    this.db.prepare(`INSERT INTO artifacts (id, chapter_id, stage_key, type, anchor_json, note, color, needs_relocation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET note = COALESCE(excluded.note, artifacts.note), anchor_json = excluded.anchor_json,
      color = excluded.color, needs_relocation = excluded.needs_relocation, updated_at = excluded.updated_at`)
      .run(id, value.chapterId, value.stageKey ?? null, value.type, JSON.stringify(value.anchor), value.note ?? null, artifactColor(value.type, value.color), value.needsRelocation ? 1 : 0, value.createdAt || now, now)
    return this.listArtifacts(value.chapterId).find((artifact) => artifact.id === id)
  }

  deleteArtifact(id) {
    const artifact = this.db.prepare('SELECT id FROM artifacts WHERE id = ?').get(id)
    if (!artifact) return false
    this.db.prepare('DELETE FROM artifacts WHERE id = ?').run(id)
    return true
  }

  saveAnswer(value) {
    this.db.prepare(`INSERT INTO ai_answers (id, chapter_id, stage_key, question, answer, confidence, citations_json, followups_json, input_tokens, output_tokens, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(value.id, value.chapterId, value.stageKey ?? null, value.question, value.answer, value.confidence, JSON.stringify(value.citations), JSON.stringify(value.followUps), value.inputTokens, value.outputTokens, value.createdAt)
  }

  listAnswers(chapterId, stageKey) {
    const rows = stageKey
      ? this.db.prepare('SELECT * FROM ai_answers WHERE chapter_id = ? AND stage_key = ? ORDER BY created_at').all(chapterId, stageKey)
      : this.db.prepare('SELECT * FROM ai_answers WHERE chapter_id = ? ORDER BY created_at').all(chapterId)
    return rows.map((row) => ({
      id: row.id, chapterId: row.chapter_id, stageKey: row.stage_key || undefined,
      question: row.question, answer: row.answer, confidence: row.confidence,
      citations: JSON.parse(row.citations_json), followUps: JSON.parse(row.followups_json),
      inputTokens: row.input_tokens, outputTokens: row.output_tokens, createdAt: row.created_at,
    }))
  }

  saveSummary(value) {
    this.db.prepare(`INSERT INTO summaries (id, scope, target_key, title, body, citations_json, input_tokens, output_tokens, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(value.id, value.scope, value.targetKey, value.title, value.body, JSON.stringify(value.citations), value.inputTokens, value.outputTokens, value.generatedAt)
    return value
  }

  listSummaries(targetKey) {
    return this.db.prepare('SELECT * FROM summaries WHERE target_key = ? ORDER BY generated_at DESC').all(targetKey).map((row) => ({
      id: row.id, scope: row.scope, targetKey: row.target_key, title: row.title, body: row.body,
      citations: JSON.parse(row.citations_json), inputTokens: row.input_tokens, outputTokens: row.output_tokens,
      generatedAt: row.generated_at,
    }))
  }

  exportArtifacts() {
    const artifacts = this.db.prepare('SELECT * FROM artifacts ORDER BY created_at').all().map((row) => ({
      id: row.id, chapterId: row.chapter_id, stageKey: row.stage_key || undefined, type: row.type, color: artifactColor(row.type, row.color),
      anchor: JSON.parse(row.anchor_json), note: row.note || undefined, needsRelocation: Boolean(row.needs_relocation),
      createdAt: row.created_at, updatedAt: row.updated_at,
    }))
    const answers = this.db.prepare('SELECT * FROM ai_answers ORDER BY created_at').all().map((row) => ({
      id: row.id, chapterId: row.chapter_id, stageKey: row.stage_key || undefined, question: row.question,
      answer: row.answer, confidence: row.confidence, citations: JSON.parse(row.citations_json), followUps: JSON.parse(row.followups_json),
      inputTokens: row.input_tokens, outputTokens: row.output_tokens, createdAt: row.created_at,
    }))
    const summaries = this.db.prepare('SELECT * FROM summaries ORDER BY generated_at').all().map((row) => ({
      id: row.id, scope: row.scope, targetKey: row.target_key, title: row.title, body: row.body,
      citations: JSON.parse(row.citations_json), inputTokens: row.input_tokens, outputTokens: row.output_tokens, generatedAt: row.generated_at,
    }))
    const documents = this.db.prepare('SELECT id, chapter_id AS chapterId, source_id AS sourceId, name, kind, checksum, page_count AS pageCount, imported_at AS importedAt FROM documents').all()
    const archiveStates = this.listArchiveStates()
    return { artifacts, answers, summaries, documents, archiveStates }
  }

  importArtifacts(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('学习档案工作区数据无效。')
    const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : []
    const answers = Array.isArray(payload.answers) ? payload.answers : []
    const summaries = Array.isArray(payload.summaries) ? payload.summaries : []
    const archiveStates = Array.isArray(payload.archiveStates) ? payload.archiveStates : []
    const text = (value, max = 200_000) => typeof value === 'string' && value.length <= max
    const jsonValue = (value) => JSON.stringify(value ?? [])
    if (artifacts.some((item) => !text(item.id, 100) || !text(item.chapterId, 100) || !['highlight', 'annotation'].includes(item.type) || !item.anchor || !text(item.createdAt, 40) || !text(item.updatedAt, 40))) throw new Error('批注备份数据无效。')
    if (answers.some((item) => !text(item.id, 100) || !text(item.chapterId, 100) || !text(item.question) || !text(item.answer) || !['low', 'medium', 'high'].includes(item.confidence) || !Array.isArray(item.citations) || !Array.isArray(item.followUps))) throw new Error('问答备份数据无效。')
    if (summaries.some((item) => !text(item.id, 100) || !['stage', 'chapter'].includes(item.scope) || !text(item.targetKey, 200) || !text(item.title, 500) || !text(item.body) || !Array.isArray(item.citations))) throw new Error('总结备份数据无效。')
    if (archiveStates.some((item) => !text(item.sourceId, 100) || !['pending', 'needs-author-action', 'failed'].includes(item.status) || !text(item.note ?? '', 1000) || !text(item.updatedAt, 40))) throw new Error('归档状态备份数据无效。')
    const insertArtifact = this.db.prepare(`INSERT INTO artifacts (id, chapter_id, stage_key, type, anchor_json, note, color, needs_relocation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET chapter_id=excluded.chapter_id, stage_key=excluded.stage_key, type=excluded.type, anchor_json=excluded.anchor_json, note=excluded.note, color=excluded.color, needs_relocation=excluded.needs_relocation, updated_at=excluded.updated_at`)
    const insertAnswer = this.db.prepare(`INSERT INTO ai_answers (id, chapter_id, stage_key, question, answer, confidence, citations_json, followups_json, input_tokens, output_tokens, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET answer=excluded.answer, confidence=excluded.confidence, citations_json=excluded.citations_json, followups_json=excluded.followups_json, input_tokens=excluded.input_tokens, output_tokens=excluded.output_tokens`)
    const insertSummary = this.db.prepare(`INSERT INTO summaries (id, scope, target_key, title, body, citations_json, input_tokens, output_tokens, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, citations_json=excluded.citations_json, input_tokens=excluded.input_tokens, output_tokens=excluded.output_tokens`)
    const insertArchiveState = this.db.prepare(`INSERT INTO archive_states (source_id, status, note, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(source_id) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at`)
    this.transaction(() => {
      for (const item of artifacts) insertArtifact.run(item.id, item.chapterId, item.stageKey ?? null, item.type, jsonValue(item.anchor), item.note ?? null, artifactColor(item.type, item.color), item.needsRelocation ? 1 : 0, item.createdAt, item.updatedAt)
      for (const item of answers) insertAnswer.run(item.id, item.chapterId, item.stageKey ?? null, item.question, item.answer, item.confidence, jsonValue(item.citations), jsonValue(item.followUps), Number(item.inputTokens) || 0, Number(item.outputTokens) || 0, item.createdAt)
      for (const item of summaries) insertSummary.run(item.id, item.scope, item.targetKey, item.title, item.body, jsonValue(item.citations), Number(item.inputTokens) || 0, Number(item.outputTokens) || 0, item.generatedAt)
      for (const item of archiveStates) insertArchiveState.run(item.sourceId, item.status, item.note ?? '', item.updatedAt)
    })
    return { artifacts: artifacts.length, answers: answers.length, summaries: summaries.length, archiveStates: archiveStates.length }
  }
}
