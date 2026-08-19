import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { MAX_PDF_BYTES, MAX_TEXT_DOCUMENT_BYTES, WorkspaceStore, cleanHtml, normalizePdfText, pdfItemsToText, splitIntoChunks } from './workspace.mjs'

describe('local document workspace', () => {
  let root
  let store

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ai-study-workspace-'))
    store = new WorkspaceStore(root)
    await store.init()
  })

  afterEach(async () => {
    store.close()
    await rm(root, { recursive: true, force: true })
  })

  it('sanitizes executable HTML while keeping readable structure', () => {
    const sanitized = cleanHtml('<h1 onclick="steal()">标题</h1><script>steal()</script><form action="https://bad.test"><input></form><p>正文</p>')
    expect(sanitized).toContain('<h1>标题</h1>')
    expect(sanitized).toContain('<p>正文</p>')
    expect(sanitized).not.toMatch(/script|onclick|form|input|bad\.test/)
  })

  it('splits Chinese text into overlapping 500–800 character chunks', () => {
    const chunks = splitIntoChunks('智能体会观察、行动并校验结果。'.repeat(100), 3, '工具调用')
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.every((chunk) => chunk.body.length <= 800 && chunk.page === 3)).toBe(true)
    expect(chunks[0].body.slice(-50)).toContain(chunks[1].body.slice(0, 20))
  })

  it('normalizes noisy PDF text without damaging English and code', () => {
    expect(normalizePdfText('大 模 型\u0001 Agent 知 识')).toBe('大模型 Agent 知识')
    expect(pdfItemsToText([
      { str: 'Agent', hasEOL: false },
      { str: 'planning', hasEOL: true },
      { str: '工 具 调 用', hasEOL: false },
    ])).toBe('Agent planning\n工具调用')
  })

  it('imports Markdown once, copies the source, and retrieves FTS5 evidence without embeddings', async () => {
    const bytes = Buffer.from('# 工具调用\n\nAgent 通过 Thought、Action、Observation 循环调用退款工具，并校验订单状态。'.repeat(12))
    const { document: first } = await store.importDocument({ chapterId: 'agent', sourceId: 'agent-manual', name: 'agent.md', kind: 'markdown', bytes, embed: null })
    const { document: duplicate, migratedArtifacts } = await store.importDocument({ chapterId: 'agent', sourceId: 'agent-manual', name: 'agent.md', kind: 'markdown', bytes, embed: null })
    expect(duplicate.id).toBe(first.id)
    expect(migratedArtifacts).toBe(0)
    expect(first).toMatchObject({ versionNumber: 1, isLatest: true, indexed: true })
    expect(store.listDocuments('agent')).toHaveLength(1)
    expect((await readFile(join(root, 'documents', `${first.id}.md`))).equals(bytes)).toBe(true)
    const evidence = await store.retrieve({ chapterId: 'agent', query: '退款工具如何校验订单状态', queryEmbedding: null })
    expect(evidence[0].body).toContain('退款工具')
  })

  it('imports a searchable PDF with stable page numbers', async () => {
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const firstPage = pdf.addPage()
    firstPage.drawText('Agent planning and tool execution', { x: 40, y: 700, size: 12, font })
    const secondPage = pdf.addPage()
    secondPage.drawText('Observation verifies the result', { x: 40, y: 700, size: 12, font })
    const { document } = await store.importDocument({ chapterId: 'agent', sourceId: 'agent-manual', name: 'agent.pdf', kind: 'pdf', bytes: Buffer.from(await pdf.save()), embed: null })
    expect(document.pageCount).toBe(2)
    expect(store.getDocumentPages(document.id)).toEqual([
      { page: 1, text: 'Agent planning and tool execution' },
      { page: 2, text: 'Observation verifies the result' },
    ])
  })

  it('reassigns a document without changing its file, checksum, or page index', async () => {
    const bytes = Buffer.from('# Agent\n\n工具调用与观察结果。'.repeat(20))
    const { document } = await store.importDocument({ chapterId: 'archive', sourceId: 'rag', name: 'agent.md', kind: 'markdown', bytes, embed: null })
    const moved = store.moveDocument(document.id, 'agent', 'agent')
    expect(moved).toMatchObject({ id: document.id, chapterId: 'agent', sourceId: 'agent', checksum: document.checksum })
    expect(store.listDocuments('archive')).toHaveLength(0)
    expect(store.getDocumentPages(document.id)[0].text).toContain('工具调用')
  })

  it('rejects oversized, forged, and textless PDF uploads', async () => {
    expect(MAX_PDF_BYTES).toBe(100 * 1024 * 1024)
    await expect(store.importDocument({ chapterId: 'agent', sourceId: 'manual', name: 'too-large.md', kind: 'markdown', bytes: Buffer.alloc(MAX_TEXT_DOCUMENT_BYTES + 1), embed: null })).rejects.toThrow('50 MB')
    await expect(store.importDocument({ chapterId: 'agent', sourceId: 'manual', name: 'fake.pdf', kind: 'pdf', bytes: Buffer.from('not a pdf'), embed: null })).rejects.toThrow('有效 PDF')
    const pdf = await PDFDocument.create()
    pdf.addPage()
    await expect(store.importDocument({ chapterId: 'agent', sourceId: 'manual', name: 'scan.pdf', kind: 'pdf', bytes: Buffer.from(await pdf.save()), embed: null })).rejects.toThrow('OCR')
  })

  it('imports annotations, answers and summaries in one validated transaction', () => {
    const payload = {
      artifacts: [{ id: 'a1', chapterId: 'agent', stageKey: 'agent:planning', type: 'highlight', anchor: { kind: 'document', documentId: 'missing', blockId: 'page-1', start: 0, end: 2, quote: '计划' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      answers: [{ id: 'q1', chapterId: 'agent', stageKey: 'agent:planning', question: '为什么？', answer: '依据不足。', confidence: 'low', citations: [], followUps: [], inputTokens: 2, outputTokens: 3, createdAt: '2026-01-01T00:00:00.000Z' }],
      summaries: [{ id: 's1', scope: 'chapter', targetKey: 'agent', title: '学习档案', body: '仍需练习。', citations: [], inputTokens: 4, outputTokens: 5, generatedAt: '2026-01-01T00:00:00.000Z' }],
    }
    expect(store.importArtifacts(payload)).toEqual({ artifacts: 1, answers: 1, summaries: 1, archiveStates: 0 })
    expect(store.exportArtifacts()).toMatchObject(payload)
    const before = store.exportArtifacts()
    expect(() => store.importArtifacts({ ...payload, answers: [{ id: 'bad' }] })).toThrow()
    expect(store.exportArtifacts()).toEqual(before)
  })

  it('persists archive blockers and includes them in validated backups', () => {
    const state = store.setArchiveState('rag', 'needs-author-action', '等待作者开放官方导出')
    expect(state).toMatchObject({ sourceId: 'rag', status: 'needs-author-action' })
    expect(store.listArchiveStates()).toEqual([state])
    expect(store.exportArtifacts().archiveStates).toEqual([state])
    expect(() => store.setArchiveState('rag', 'indexed')).toThrow('归档状态无效')
  })

  it('removes only obsolete empty archive states and preserves records with local files', async () => {
    store.setArchiveState('obsolete-empty', 'pending', '')
    store.setArchiveState('obsolete-with-file', 'pending', '')
    await store.importDocument({
      chapterId: 'archive', sourceId: 'obsolete-with-file', name: 'kept.md', kind: 'markdown',
      bytes: Buffer.from('# 本地文件\n\n这份文件必须被保留。'.repeat(30)), embed: null,
    })

    expect(store.pruneArchiveStates(new Set(['agent']))).toEqual({
      removed: ['obsolete-empty'],
      preserved: ['obsolete-with-file'],
    })
    expect(store.listArchiveStates().map((item) => item.sourceId)).toEqual(['obsolete-with-file'])
    expect(store.listDocuments('archive')).toHaveLength(1)
  })

  it('creates ordered versions and relocates an annotation only when quote and context match uniquely', async () => {
    const firstBytes = Buffer.from(`# 第一版\n\n在退款流程中，工具调用完成后必须核对订单状态，避免重复退款。\n\n结尾说明。${'补充内容。'.repeat(80)}`)
    const { document: first } = await store.importDocument({ chapterId: 'agent', sourceId: 'agent-manual', name: 'agent-v1.md', kind: 'markdown', bytes: firstBytes, embed: null })
    const text = store.getDocumentPages(first.id)[0].text
    const quote = '工具调用完成后必须核对订单状态'
    const start = text.indexOf(quote)
    store.saveArtifact({
      chapterId: 'agent', stageKey: 'agent:tools', type: 'annotation', note: '这是关键检查点',
      anchor: { kind: 'document', documentId: first.id, page: 1, blockId: 'document-html', start, end: start + quote.length, quote },
    })

    const secondBytes = Buffer.from(`# 第一版\n\n在退款流程中，工具调用完成后必须核对订单状态，避免重复退款。\n\n结尾说明。${'补充内容。'.repeat(80)}\n\n新增附录。`)
    const imported = await store.importDocument({ chapterId: 'agent', sourceId: 'agent-manual', name: 'agent-v2.md', kind: 'markdown', bytes: secondBytes, embed: null })
    expect(imported).toMatchObject({ migratedArtifacts: 1, relocationRequired: 0 })
    expect(store.listDocuments('agent')).toEqual([
      expect.objectContaining({ id: imported.document.id, versionNumber: 2, isLatest: true }),
      expect.objectContaining({ id: first.id, versionNumber: 1, isLatest: false }),
    ])
    const migrated = store.listArtifacts('agent', 'agent:tools').find((item) => item.anchor.kind === 'document' && item.anchor.documentId === imported.document.id)
    expect(migrated).toMatchObject({ note: '这是关键检查点', needsRelocation: false })
    expect(migrated.anchor.page).toBe(1)
  })

  it('lists all document artifacts across stages while preserving stage filters', async () => {
    const { document } = await store.importDocument({
      chapterId: 'agent', sourceId: 'agent-manual', name: 'agent.md', kind: 'markdown',
      bytes: Buffer.from(`# Agent\n\n模型负责判断，工具负责读取事实。${'补充说明。'.repeat(60)}`), embed: null,
    })
    const anchor = { kind: 'document', documentId: document.id, page: 1, blockId: 'document-html', start: 0, end: 2, quote: '模型' }
    store.saveArtifact({ chapterId: 'agent', stageKey: 'agent:first', type: 'highlight', anchor })
    store.saveArtifact({ chapterId: 'agent', stageKey: 'agent:second', type: 'annotation', anchor, note: '跨关卡可见' })

    expect(store.listArtifacts('agent')).toHaveLength(2)
    expect(store.listArtifacts('agent', 'agent:first')).toHaveLength(1)
  })

  it('deduplicates the same saved artifact and deletes only the requested record', async () => {
    const { document } = await store.importDocument({
      chapterId: 'agent', sourceId: 'artifact-actions', name: 'artifact-actions.md', kind: 'markdown',
      bytes: Buffer.from(`# Agent\n\n模型负责判断，工具负责读取事实。${'补充说明。'.repeat(60)}`), embed: null,
    })
    const anchor = { kind: 'document', documentId: document.id, page: 1, blockId: 'document-html', start: 0, end: 2, quote: '模型' }
    const highlight = store.saveArtifact({ chapterId: 'agent', stageKey: 'agent:first', type: 'highlight', anchor })
    const duplicate = store.saveArtifact({ chapterId: 'agent', stageKey: 'agent:second', type: 'highlight', anchor })
    const annotation = store.saveArtifact({ chapterId: 'agent', stageKey: 'agent:second', type: 'annotation', anchor, note: '保留这条批注' })

    expect(duplicate.id).toBe(highlight.id)
    expect(store.listArtifacts('agent')).toHaveLength(2)
    expect(store.deleteArtifact(highlight.id)).toBe(true)
    expect(store.deleteArtifact(highlight.id)).toBe(false)
    expect(store.listArtifacts('agent')).toEqual([annotation])
  })

  it('defaults legacy artifact colors and preserves selected colors through export and import', async () => {
    const { document } = await store.importDocument({
      chapterId: 'agent', sourceId: 'colors', name: 'colors.md', kind: 'markdown',
      bytes: Buffer.from(`# Agent\n\n模型负责判断。${'补充说明。'.repeat(60)}`), embed: null,
    })
    const anchor = { kind: 'document', documentId: document.id, page: 1, blockId: 'document-html', start: 0, end: 2, quote: '模型' }
    const legacy = store.saveArtifact({ chapterId: 'agent', type: 'highlight', anchor })
    const annotation = store.saveArtifact({ chapterId: 'agent', type: 'annotation', anchor, note: '蓝色批注', color: 'purple' })

    expect(legacy.color).toBe('yellow')
    expect(annotation.color).toBe('purple')
    const exported = store.exportArtifacts()
    expect(exported.artifacts.find((artifact) => artifact.id === annotation.id)?.color).toBe('purple')
    expect(store.importArtifacts({ ...exported, artifacts: exported.artifacts.map((artifact) => artifact.id === legacy.id ? { ...artifact, color: undefined } : artifact) })).toMatchObject({ artifacts: 2 })
    expect(store.listArtifacts('agent').find((artifact) => artifact.id === legacy.id)?.color).toBe('yellow')
  })

  it('keeps ambiguous or missing annotation quotes as pending relocation records', async () => {
    const { document: first } = await store.importDocument({
      chapterId: 'rag', sourceId: 'rag', name: 'rag-v1.md', kind: 'markdown',
      bytes: Buffer.from('# RAG\n\n先检索证据，再生成回答。\n\n唯一上下文。'.repeat(6)), embed: null,
    })
    const text = store.getDocumentPages(first.id)[0].text
    const quote = '先检索证据，再生成回答'
    const start = text.indexOf(quote)
    store.saveArtifact({ chapterId: 'rag', type: 'highlight', anchor: { kind: 'document', documentId: first.id, page: 1, blockId: 'document-html', start, end: start + quote.length, quote } })
    const imported = await store.importDocument({
      chapterId: 'rag', sourceId: 'rag', name: 'rag-v2.md', kind: 'markdown',
      bytes: Buffer.from('# RAG 新版\n\n内容已重写，不再保留原句。'.repeat(12)), embed: null,
    })
    expect(imported).toMatchObject({ migratedArtifacts: 1, relocationRequired: 1 })
    const pending = store.listArtifacts('rag').find((item) => item.anchor.kind === 'document' && item.anchor.documentId === imported.document.id)
    expect(pending).toMatchObject({ needsRelocation: true })
    expect(pending.anchor.page).toBeUndefined()
  })

  it('does not guess when the same quote and context appears more than once in a new version', async () => {
    const paragraph = 'Before the marker, verify the order state. UNIQUE QUOTE. After the marker, record the result.'
    const { document: first } = await store.importDocument({
      chapterId: 'agent', sourceId: 'ambiguity', name: 'ambiguity-v1.md', kind: 'markdown',
      bytes: Buffer.from(`# Version one\n\n${paragraph}\n\n${'Additional material. '.repeat(80)}`), embed: null,
    })
    const text = store.getDocumentPages(first.id)[0].text
    const quote = 'UNIQUE QUOTE'
    const start = text.indexOf(quote)
    store.saveArtifact({
      chapterId: 'agent', type: 'highlight',
      anchor: { kind: 'document', documentId: first.id, page: 1, blockId: 'document-html', start, end: start + quote.length, quote },
    })

    const imported = await store.importDocument({
      chapterId: 'agent', sourceId: 'ambiguity', name: 'ambiguity-v2.md', kind: 'markdown',
      bytes: Buffer.from(`# Version two\n\n${paragraph}\n\n${paragraph}\n\n${'Additional material. '.repeat(80)}`), embed: null,
    })
    expect(imported).toMatchObject({ migratedArtifacts: 1, relocationRequired: 1 })
    const migrated = store.listArtifacts('agent').find((item) => item.anchor.kind === 'document' && item.anchor.documentId === imported.document.id)
    expect(migrated).toMatchObject({ needsRelocation: true })
    expect(migrated.anchor.page).toBeUndefined()
  })

  it('removes the copied file when the database transaction fails', async () => {
    const before = await readdir(join(root, 'documents'))
    store.db.exec(`CREATE TRIGGER reject_document BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT, 'forced failure'); END;`)
    await expect(store.importDocument({
      chapterId: 'agent', sourceId: 'rollback', name: 'rollback.md', kind: 'markdown',
      bytes: Buffer.from('# 回滚测试\n\n数据库失败时不能留下孤立文件。'.repeat(20)), embed: null,
    })).rejects.toThrow('forced failure')
    expect(await readdir(join(root, 'documents'))).toEqual(before)
    expect(store.listDocuments('agent')).toHaveLength(0)
  })
})
