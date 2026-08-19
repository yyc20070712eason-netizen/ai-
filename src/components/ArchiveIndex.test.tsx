import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ARCHIVE_CATALOG } from '../content/archiveCatalog'
import type { ArchiveRecord } from '../types'
import { ArchiveIndex } from './ArchiveIndex'

afterEach(cleanup)

function records(): ArchiveRecord[] {
  return ARCHIVE_CATALOG.map((item) => ({ ...item, status: 'pending', note: '', documents: [] }))
}

describe('archive index', () => {
  it('renders all seven sources as a responsive ledger and exposes explicit blocked status', () => {
    const onSetStatus = vi.fn()
    render(<ArchiveIndex records={records()} busy="" message="" error="" onBatchImport={vi.fn()} onImport={vi.fn()} onOpenDocument={vi.fn()} onDeleteDocument={vi.fn()} onSetStatus={onSetStatus} />)
    expect(screen.getByRole('heading', { level: 1, name: '7 份 AI 资料' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    fireEvent.click(screen.getAllByRole('button', { name: '导出受限' })[0])
    expect(onSetStatus).toHaveBeenCalledWith('agent', 'needs-author-action')
  })

  it('keeps Feishu available after a PDF has been imported without showing chapter progress here', () => {
    const next = records()
    next[0].documents = [{
      id: 'doc-agent',
      chapterId: 'archive',
      sourceId: 'agent',
      name: 'Agent 手册.pdf',
      kind: 'pdf',
      size: 1024,
      checksum: 'checksum',
      pageCount: 111,
      chunkCount: 172,
      indexed: true,
      importedAt: new Date().toISOString(),
      versionNumber: 1,
      isLatest: true,
    }]
    render(<ArchiveIndex records={next} busy="" message="" error="" onBatchImport={vi.fn()} onImport={vi.fn()} onOpenDocument={vi.fn()} onDeleteDocument={vi.fn()} onSetStatus={vi.fn()} />)

    const agentRow = screen.getByText('Agent 手册').closest('li')
    expect(agentRow).not.toBeNull()
    expect(within(agentRow!).getByRole('link', { name: '打开飞书' })).toHaveAttribute('href', next[0].url)
    expect(within(agentRow!).queryByRole('button', { name: /本章进度/ })).not.toBeInTheDocument()
  })
})
