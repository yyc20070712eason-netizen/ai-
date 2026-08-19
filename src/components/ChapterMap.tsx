import {
  ArrowRight,
  BookMarked,
  Check,
  Circle,
  Clock3,
  FileUp,
  RefreshCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type {
  ChapterPackage,
  LearningSummary,
  ReviewItem,
  Stage,
  StageKey,
  StageProgress,
  WorkspaceDocument,
} from '../types'
import { flattenChapter } from '../content/registry'
import { makeStageKey } from '../content/schema'

type ChapterMapProps = {
  chapter: ChapterPackage
  progress: Record<StageKey, StageProgress>
  dueItems: ReviewItem[]
  documents: WorkspaceDocument[]
  summaries: LearningSummary[]
  busy: string
  error: string
  onContinue: () => void
  onOpenStage: (stage: Stage) => void
  onReview: () => void
  onImport: (file?: File) => void
  onOpenDocument: (document: WorkspaceDocument) => void
  onDeleteDocument: (document: WorkspaceDocument) => void
  onGenerateSummary: () => void
}

function statusFor(stageKey: StageKey, progress: StageProgress | undefined, due: Set<string>) {
  if (due.has(stageKey)) return { key: 'due', label: '待复习' }
  if (progress?.weak) return { key: 'weak', label: '薄弱' }
  if (progress?.completedAt) return { key: 'mastered', label: '已掌握' }
  if (progress?.firstOpenedAt || progress?.note || progress?.quizResult) return { key: 'active', label: '学习中' }
  return { key: 'new', label: '未开始' }
}

export function ChapterMap({
  chapter,
  progress,
  dueItems,
  documents,
  summaries,
  busy,
  error,
  onContinue,
  onOpenStage,
  onReview,
  onImport,
  onOpenDocument,
  onDeleteDocument,
  onGenerateSummary,
}: ChapterMapProps) {
  const stages = flattenChapter(chapter)
  const due = new Set(dueItems.map((item) => makeStageKey(item.stage)))
  const mastered = stages.filter((stage) => progress[makeStageKey({ chapterId: chapter.id, stageId: stage.id })]?.completedAt).length
  const remainingMinutes = stages
    .filter((stage) => !progress[makeStageKey({ chapterId: chapter.id, stageId: stage.id })]?.completedAt)
    .reduce((total, stage) => total + stage.durationMinutes, 0)
  const latestSummary = summaries[0]

  return (
    <article className="chapter-map" aria-labelledby="chapter-map-title">
      <header className="chapter-map__header">
        <div>
          <p className="chapter-map__eyebrow">章节知识地图</p>
          <h1 id="chapter-map-title">{chapter.title}</h1>
          <p>先看清知识全貌，再进入一关。所有关卡都可以自由预览。</p>
        </div>
        <button className="button button--primary" type="button" onClick={onContinue}>
          继续学习 <ArrowRight aria-hidden="true" />
        </button>
      </header>

      <dl className="chapter-map__stats">
        <div><dt>已掌握</dt><dd>{mastered} / {stages.length}</dd></div>
        <div><dt>剩余学习</dt><dd>约 {remainingMinutes} 分钟</dd></div>
        <div><dt>到期复习</dt><dd>{dueItems.length} 关</dd></div>
      </dl>

      {dueItems.length > 0 && (
        <button className="chapter-map__review" type="button" onClick={onReview}>
          <RefreshCcw aria-hidden="true" />
          <span><strong>今天先复习 {dueItems.length} 关</strong><small>每关一道高价值题，不重复刷题</small></span>
          <ArrowRight aria-hidden="true" />
        </button>
      )}

      <div className="chapter-map__workspace">
        <div className="unit-tracks">
          {chapter.units.map((unit, unitIndex) => (
            <section className="unit-track" key={unit.id} aria-labelledby={`unit-${unit.id}`}>
              <header className="unit-track__header">
                <span>{String(unitIndex + 1).padStart(2, '0')}</span>
                <h2 id={`unit-${unit.id}`}>{unit.title}</h2>
                <small>{unit.stageIds.length} 关</small>
              </header>
              <div className="unit-track__cards">
                {unit.stageIds.map((stageId) => {
                  const stage = chapter.stages.find((item) => item.id === stageId)
                  if (!stage) return null
                  const stageKey = makeStageKey({ chapterId: chapter.id, stageId })
                  const status = statusFor(stageKey, progress[stageKey], due)
                  const number = stages.findIndex((item) => item.id === stage.id) + 1
                  return (
                    <button className={`stage-card is-${status.key}`} type="button" key={stage.id} onClick={() => onOpenStage(stage)}>
                      <span className="stage-card__top">
                        <span>{progress[stageKey]?.completedAt ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}{String(number).padStart(2, '0')}</span>
                        <small>{status.label}</small>
                      </span>
                      <strong>{stage.title}</strong>
                      <span className="stage-card__outcome">{stage.outcome}</span>
                      <span className="stage-card__time"><Clock3 aria-hidden="true" />{stage.durationMinutes} 分钟</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="chapter-map__tools" aria-label="章节学习工具">
          <section>
            <div className="tool-section__title"><BookMarked aria-hidden="true" /><h2>本章原文</h2></div>
            {documents.length > 0 ? (
              <ul className="document-list">
                {documents.map((document) => (
                  <li key={document.id}>
                    <button className="document-list__open" type="button" onClick={() => onOpenDocument(document)}>
                      <strong>{document.name}</strong>
                      <span>{document.pageCount} 页 · {document.chunkCount} 段{document.indexed ? ' · 已建立语义索引' : ' · 关键词索引'}</span>
                    </button>
                    <button className="document-list__delete" type="button" onClick={() => onDeleteDocument(document)} aria-label={`删除 ${document.name}`}><Trash2 aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            ) : <p>导入有权使用的原文后，才能按页批注并让 AI 引用证据。</p>}
            <label className={`button button--secondary file-button ${busy === 'import' ? 'is-loading' : ''}`}>
              <FileUp aria-hidden="true" />{busy === 'import' ? '正在解析与索引…' : '导入 PDF / Markdown / HTML'}
              <input type="file" accept=".pdf,.md,.markdown,.html,.htm,application/pdf,text/markdown,text/html" disabled={busy === 'import'} onChange={(event) => onImport(event.target.files?.[0])} />
            </label>
          </section>

          <section>
            <div className="tool-section__title"><Sparkles aria-hidden="true" /><h2>学习档案</h2></div>
            {latestSummary ? (
              <div className="summary-excerpt"><strong>{latestSummary.title}</strong><p>{latestSummary.body.slice(0, 220)}{latestSummary.body.length > 220 ? '…' : ''}</p><small>{latestSummary.inputTokens + latestSummary.outputTokens} tokens</small></div>
            ) : <p>汇总本章笔记、高亮、错题和追问，只在你点击时调用模型。</p>}
            <button className="text-link" type="button" onClick={onGenerateSummary} disabled={busy === 'summary' || mastered === 0}>
              {busy === 'summary' ? '正在生成…' : '生成章节学习档案'} <ArrowRight aria-hidden="true" />
            </button>
          </section>
          {error && <p className="form-error" role="alert">{error}</p>}
        </aside>
      </div>
    </article>
  )
}
