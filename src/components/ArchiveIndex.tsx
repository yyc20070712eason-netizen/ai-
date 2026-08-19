import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleDashed,
  FileArchive,
  FileUp,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { ArchiveManualStatus, ArchiveRecord, WorkspaceDocument } from '../types'

type ArchiveIndexProps = {
  records: ArchiveRecord[]
  busy: string
  message: string
  error: string
  onBatchImport: (files: File[]) => void
  onImport: (sourceId: string, file?: File) => void
  onOpenDocument: (document: WorkspaceDocument) => void
  onDeleteDocument: (document: WorkspaceDocument) => void
  onSetStatus: (sourceId: string, status: ArchiveManualStatus) => void
}

const STATUS_LABELS: Record<ArchiveRecord['status'], string> = {
  pending: '待检查',
  'needs-author-action': '需要作者操作',
  failed: '处理失败',
  archived: '已保存',
  indexed: '已建立索引',
}

function statusIcon(status: ArchiveRecord['status']) {
  if (status === 'indexed' || status === 'archived') return <Check aria-hidden="true" />
  if (status === 'needs-author-action' || status === 'failed') return <AlertTriangle aria-hidden="true" />
  return <CircleDashed aria-hidden="true" />
}

function openFilePickerFromKeyboard(event: KeyboardEvent<HTMLLabelElement>) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')?.click()
}

export function ArchiveIndex({
  records,
  busy,
  message,
  error,
  onBatchImport,
  onImport,
  onOpenDocument,
  onDeleteDocument,
  onSetStatus,
}: ArchiveIndexProps) {
  const archived = records.filter((record) => record.documents.length > 0).length
  const indexed = records.filter((record) => record.status === 'indexed').length
  const needsAction = records.filter((record) => record.status === 'needs-author-action').length

  return (
    <article className="archive-index" aria-labelledby="archive-title" aria-busy={Boolean(busy)}>
      <header className="archive-index__header">
        <div>
          <p>个人学习归档</p>
          <h1 id="archive-title">{records.length} 份 AI 资料</h1>
          <span>原始 PDF 留在本机；检索文本按页建立索引。密码只在飞书页面输入。</span>
        </div>
        <label
          className={`button button--primary file-button ${busy ? 'is-loading' : ''}`}
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={Boolean(busy)}
          onKeyDown={openFilePickerFromKeyboard}
        >
          <FileUp aria-hidden="true" />{busy === 'batch' ? '正在逐份导入…' : '导入整批 PDF'}
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            disabled={Boolean(busy)}
            onChange={(event) => {
              onBatchImport(Array.from(event.target.files ?? []))
              event.currentTarget.value = ''
            }}
          />
        </label>
      </header>

      <dl className="archive-index__stats">
        <div><dt>资料总数</dt><dd>{records.length}</dd></div>
        <div><dt>已保存</dt><dd>{archived}</dd></div>
        <div><dt>可检索</dt><dd>{indexed}</dd></div>
        <div><dt>等待授权</dt><dd>{needsAction}</dd></div>
      </dl>

      <section className="archive-ledger" aria-label="飞书资料归档清单">
        <header className="archive-ledger__head">
          <span>资料</span><span>本地状态</span><span>操作</span>
        </header>
        <ol>
          {records.map((record) => {
            const latest = record.documents[0]
            return (
              <li className="archive-row" key={record.id}>
                <span className="archive-row__number">{String(record.order).padStart(2, '0')}</span>
                <div className="archive-row__identity">
                  <strong>{record.title}</strong>
                  <span>{record.courseReady ? '已制作学习章节' : '待制作学习章节'} · {record.documents.length ? `${record.documents.length} 个本地版本` : '尚无本地文件'}</span>
                </div>
                <div className={`archive-status is-${record.status}`}>
                  {statusIcon(record.status)}
                  <span><strong>{STATUS_LABELS[record.status]}</strong>{latest ? <small>v{latest.versionNumber} · {latest.pageCount} 页 · {latest.chunkCount} 段</small> : record.note ? <small>{record.note}</small> : null}</span>
                </div>
                <div className="archive-row__actions">
                  {latest ? (
                    <>
                      <button className="text-link" type="button" onClick={() => onOpenDocument(latest)}><BookOpen aria-hidden="true" />阅读</button>
                      <a className="text-link" href={record.url} target="_blank" rel="noreferrer"><ArrowUpRight aria-hidden="true" />打开飞书</a>
                      <label className="text-link file-button" role="button" tabIndex={busy ? -1 : 0} aria-disabled={Boolean(busy)} onKeyDown={openFilePickerFromKeyboard}>
                        <RefreshCcw aria-hidden="true" />新版本
                        <input type="file" accept=".pdf,application/pdf" disabled={Boolean(busy)} onChange={(event) => { onImport(record.id, event.target.files?.[0]); event.currentTarget.value = '' }} />
                      </label>
                      <button className="icon-button icon-button--quiet" type="button" aria-label={`删除 ${latest.name}`} onClick={() => onDeleteDocument(latest)}><Trash2 aria-hidden="true" /></button>
                    </>
                  ) : (
                    <>
                      <a className="text-link" href={record.url} target="_blank" rel="noreferrer"><ArrowUpRight aria-hidden="true" />打开飞书</a>
                      <label className="text-link file-button" role="button" tabIndex={busy ? -1 : 0} aria-disabled={Boolean(busy)} onKeyDown={openFilePickerFromKeyboard}>
                        <FileArchive aria-hidden="true" />导入 PDF
                        <input type="file" accept=".pdf,application/pdf" disabled={Boolean(busy)} onChange={(event) => { onImport(record.id, event.target.files?.[0]); event.currentTarget.value = '' }} />
                      </label>
                      {record.status === 'needs-author-action' ? (
                        <button className="text-link" type="button" disabled={Boolean(busy)} onClick={() => onSetStatus(record.id, 'pending')}>重新检查</button>
                      ) : (
                        <button className="text-link" type="button" disabled={Boolean(busy)} onClick={() => onSetStatus(record.id, 'needs-author-action')}>导出受限</button>
                      )}
                    </>
                  )}
                </div>
                {record.documents.length > 0 && (
                  <details className="archive-row__versions">
                    <summary>{record.documents.length} 个本地版本</summary>
                    <ol>
                      {record.documents.map((document) => (
                        <li key={document.id}>
                          <span>
                            <strong>v{document.versionNumber}{document.isLatest ? ' · 当前版本' : ''}</strong>
                            <small>{document.pageCount} 页 · {document.chunkCount} 段 · {new Date(document.importedAt).toLocaleDateString('zh-CN')}</small>
                          </span>
                          <button className="text-link" type="button" onClick={() => onOpenDocument(document)}><BookOpen aria-hidden="true" />阅读</button>
                          <button className="icon-button icon-button--quiet" type="button" aria-label={`删除 ${document.name} v${document.versionNumber}`} onClick={() => onDeleteDocument(document)}><Trash2 aria-hidden="true" /></button>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <p className={`archive-index__feedback ${error ? 'is-error' : ''}`} aria-live="polite">{error || message}</p>
    </article>
  )
}
