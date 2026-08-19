import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LearningArtifact, WorkspaceDocument } from '../types'
import { SourceWorkspace } from './SourceWorkspace'

const workspaceMocks = vi.hoisted(() => ({
  askAi: vi.fn(),
  deleteArtifact: vi.fn(),
  getDocumentHtml: vi.fn(),
  getDocumentPages: vi.fn(),
  listAiAnswers: vi.fn(),
  listArtifacts: vi.fn(),
  saveArtifact: vi.fn(),
  WorkspaceApiError: class WorkspaceApiError extends Error {
    code?: string
    constructor(message: string, code?: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('../lib/workspace', () => workspaceMocks)
vi.mock('../lib/pdfRuntime', () => ({ loadPdfRuntime: vi.fn(), supportsEnhancedPdfRenderer: () => true }))

const sourceDocument = {
  id: 'document-1', chapterId: 'agent', sourceId: 'manual', name: 'Agent.md', kind: 'markdown',
  size: 100, checksum: 'checksum', pageCount: 1, chunkCount: 1, indexed: true,
  importedAt: '2026-08-12T00:00:00.000Z', versionNumber: 1, isLatest: true,
} satisfies WorkspaceDocument

const savedHighlight = {
  id: 'artifact-1', chapterId: 'agent', stageKey: 'agent:first', type: 'highlight',
  anchor: { kind: 'document', documentId: sourceDocument.id, page: 1, blockId: 'document-html', start: 0, end: 6, quote: '模型负责判断' },
  createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
} satisfies LearningArtifact

const savedAnnotation = {
  ...savedHighlight, id: 'annotation-1', type: 'annotation' as const, color: 'blue' as const, note: '自动保存的批注',
  anchor: { ...savedHighlight.anchor, start: 7, end: 11, quote: '工具负责' },
} satisfies LearningArtifact

const relocationHighlight = {
  ...savedHighlight,
  id: 'artifact-needs-relocation',
  needsRelocation: true,
  anchor: { ...savedHighlight.anchor, start: 0, end: 5, quote: '已删除的原句' },
} satisfies LearningArtifact

function selectQuote() {
  const article = screen.getByRole('article')
  const textNode = article.querySelector('p')?.firstChild
  if (!textNode) throw new Error('test source text missing')
  const range = document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, 6)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  fireEvent.mouseUp(article)
}

describe('source workspace learning artifacts', () => {
  beforeEach(() => {
    workspaceMocks.getDocumentPages.mockResolvedValue([{ page: 1, text: '模型负责判断，工具负责读取事实。' }])
    workspaceMocks.getDocumentHtml.mockResolvedValue({ id: sourceDocument.id, kind: 'markdown', html: '<p>模型负责判断，工具负责读取事实。</p>' })
    workspaceMocks.listAiAnswers.mockResolvedValue([])
    workspaceMocks.listArtifacts.mockResolvedValue([])
    workspaceMocks.saveArtifact.mockResolvedValue(savedHighlight)
    workspaceMocks.deleteArtifact.mockResolvedValue({ ok: true })
    if (!Range.prototype.getClientRects) Object.defineProperty(Range.prototype, 'getClientRects', { value: () => [] })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps a selection temporary until 保存重点 succeeds', async () => {
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    expect(await screen.findByText('1 页 · 0 条重点')).toBeInTheDocument()

    selectQuote()
    expect(screen.getByRole('button', { name: '保存重点' })).toBeInTheDocument()
    expect(screen.getByText('1 页 · 0 条重点')).toBeInTheDocument()
    expect(workspaceMocks.saveArtifact).not.toHaveBeenCalled()

    fireEvent.pointerDown(screen.getByRole('button', { name: '保存重点' }))
    fireEvent.click(screen.getByRole('button', { name: '保存重点' }))
    await waitFor(() => expect(workspaceMocks.saveArtifact).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('1 页 · 1 条重点')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '撤销' })).not.toHaveLength(0)
  })

  it('shows a safe key-recovery action instead of an upstream API error', async () => {
    const onRequestKeyUpdate = vi.fn()
    workspaceMocks.askAi.mockRejectedValue(new workspaceMocks.WorkspaceApiError('API Key 无效或已失效，请在设置中更新后重试。', 'api_key_invalid'))
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} onRequestKeyUpdate={onRequestKeyUpdate} />)
    await screen.findByRole('article')

    selectQuote()
    fireEvent.click(screen.getByRole('button', { name: '问 AI' }))
    const update = await screen.findByRole('button', { name: '更新 API Key' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('API Key 无效或已失效')
    expect(alert).not.toHaveTextContent('sk-')
    fireEvent.click(update)
    expect(onRequestKeyUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not count a highlight when persistence fails', async () => {
    workspaceMocks.saveArtifact.mockRejectedValueOnce(new Error('数据库暂时不可写'))
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    expect(await screen.findByText('1 页 · 0 条重点')).toBeInTheDocument()

    selectQuote()
    fireEvent.click(screen.getByRole('button', { name: '保存重点' }))

    expect((await screen.findAllByRole('alert')).every((alert) => alert.textContent === '数据库暂时不可写')).toBe(true)
    expect(screen.getByText('1 页 · 0 条重点')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '撤销' })).not.toBeInTheDocument()
  })

  it('removes a persisted highlight and leaves it removed after reload', async () => {
    workspaceMocks.listArtifacts.mockResolvedValueOnce([savedHighlight]).mockResolvedValueOnce([])
    const first = render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    expect(await screen.findByText('1 页 · 1 条重点')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重点操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除重点' }))
    await waitFor(() => expect(workspaceMocks.deleteArtifact).toHaveBeenCalledWith(savedHighlight.id))
    expect(await screen.findByText('1 页 · 0 条重点')).toBeInTheDocument()

    first.unmount()
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    expect(await screen.findByText('1 页 · 0 条重点')).toBeInTheDocument()
  })

  it('retains a highlight when cancellation fails', async () => {
    workspaceMocks.listArtifacts.mockResolvedValue([savedHighlight])
    workspaceMocks.deleteArtifact.mockRejectedValueOnce(new Error('删除请求失败'))
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    expect(await screen.findByText('1 页 · 1 条重点')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重点操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除重点' }))

    expect((await screen.findAllByRole('alert')).every((alert) => alert.textContent === '删除请求失败')).toBe(true)
    expect(screen.getByText('1 页 · 1 条重点')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重点操作' })).toBeInTheDocument()
  })

  it('autosaves an annotation after typing and updates the same record', async () => {
    workspaceMocks.saveArtifact.mockResolvedValue(savedAnnotation)
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    await screen.findByText('1 页 · 0 条重点')
    selectQuote()
    fireEvent.click(screen.getByRole('button', { name: '写批注' }))
    vi.useFakeTimers()
    fireEvent.change(screen.getByPlaceholderText('写下你的理解或疑问'), { target: { value: '自动保存的批注' } })
    await vi.advanceTimersByTimeAsync(800)
    expect(workspaceMocks.saveArtifact).toHaveBeenCalledWith(expect.objectContaining({ type: 'annotation', note: '自动保存的批注', color: 'blue' }))
    vi.useRealTimers()
  })

  it('keeps highlights on the left and annotations on the right tab', async () => {
    workspaceMocks.listArtifacts.mockResolvedValue([savedHighlight, savedAnnotation])
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)

    expect(await screen.findByText('1 页 · 1 条重点')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '批注 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('自动保存的批注')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重点操作' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '批注操作' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '原文追问 0' }))
    expect(screen.getByRole('tab', { name: '原文追问 0' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('向原文提问')).toBeInTheDocument()
  })

  it('opens and closes the highlight menu without hover-only controls', async () => {
    workspaceMocks.listArtifacts.mockResolvedValue([savedHighlight])
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    await screen.findByText('1 页 · 1 条重点')

    const trigger = screen.getByRole('button', { name: '重点操作' })
    expect(screen.queryByRole('menu', { name: '重点操作菜单' })).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu', { name: '重点操作菜单' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu', { name: '重点操作菜单' })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    expect(screen.getByRole('menu', { name: '重点操作菜单' })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(screen.queryByRole('menu', { name: '重点操作菜单' })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('renders the action menu in a viewport portal instead of inside the scrolling outline', async () => {
    workspaceMocks.listArtifacts.mockResolvedValue([savedHighlight])
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    await screen.findByText('1 页 · 1 条重点')

    fireEvent.click(screen.getByRole('button', { name: '重点操作' }))
    const menu = screen.getByRole('menu', { name: '重点操作菜单' })
    expect(menu.parentElement).toBe(document.body)
    expect(document.getElementById('source-outline')?.contains(menu)).toBe(false)
    expect(screen.getByRole('menuitem', { name: '删除重点' })).toBeVisible()
  })

  it('restores the most recently deleted artifact with its original id', async () => {
    workspaceMocks.listArtifacts.mockResolvedValue([savedHighlight])
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    await screen.findByText('1 页 · 1 条重点')

    fireEvent.click(screen.getByRole('button', { name: '重点操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除重点' }))
    expect(await screen.findByText('重点已删除')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => expect(workspaceMocks.saveArtifact).toHaveBeenCalledWith(savedHighlight))
    expect(await screen.findByText('1 页 · 1 条重点')).toBeInTheDocument()
  })

  it('automatically restores a uniquely matchable PDF-style highlight without changing its identity', async () => {
    const staleHighlight = {
      ...savedHighlight,
      id: 'newline-highlight',
      needsRelocation: true,
      anchor: { ...savedHighlight.anchor, start: 0, end: 10, quote: 'Alpha\nbeta' },
    }
    workspaceMocks.getDocumentPages.mockResolvedValue([{ page: 1, text: 'Alpha beta Gamma' }])
    workspaceMocks.getDocumentHtml.mockResolvedValue({ id: sourceDocument.id, kind: 'markdown', html: '<p>Alpha beta Gamma</p>' })
    workspaceMocks.listArtifacts.mockResolvedValue([staleHighlight])
    workspaceMocks.saveArtifact.mockImplementation(async (artifact) => ({ ...artifact, updatedAt: '2026-08-13T00:00:00.000Z' }))
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)

    await waitFor(() => expect(workspaceMocks.saveArtifact).toHaveBeenCalledWith(expect.objectContaining({
      id: staleHighlight.id,
      needsRelocation: false,
      anchor: expect.objectContaining({ start: 0, end: 10, quote: 'Alpha\nbeta' }),
    })))
  })

  it('keeps a relocation record until the user explicitly binds new text to the same artifact', async () => {
    workspaceMocks.listArtifacts.mockResolvedValue([relocationHighlight])
    workspaceMocks.saveArtifact.mockImplementation(async (artifact) => artifact)
    render(<SourceWorkspace chapter={{ id: 'agent', title: 'Agent 手册' }} document={sourceDocument} />)
    await screen.findByText('待重新定位 · 第 1 页')
    workspaceMocks.saveArtifact.mockClear()

    fireEvent.click(screen.getByRole('button', { name: '重点操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重新定位' }))
    expect(screen.getByText('正在重新定位：选中正确文字后点击“绑定到此处”。')).toBeInTheDocument()

    selectQuote()
    fireEvent.click(screen.getByRole('button', { name: '绑定到此处' }))
    await waitFor(() => expect(workspaceMocks.saveArtifact).toHaveBeenCalledWith(expect.objectContaining({
      id: relocationHighlight.id,
      createdAt: relocationHighlight.createdAt,
      needsRelocation: false,
      anchor: expect.objectContaining({ quote: '模型负责判断' }),
    })))
  })
})
