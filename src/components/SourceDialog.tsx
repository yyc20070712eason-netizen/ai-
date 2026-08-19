import { ArrowLeft, ExternalLink } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import type { ChapterPackage, SourceDefinition, SourceReference } from '../types'

type SourceDialogProps = {
  chapter: ChapterPackage
  sourceRefs: SourceReference[]
  onRequestClose: () => void
}

type ResolvedSource = {
  definition: SourceDefinition
  reference: SourceReference
  href: string
  canEmbed: boolean
}

function resolveHref(definition: SourceDefinition, reference: SourceReference) {
  const base = definition.kind === 'remote' ? definition.url : definition.assetUrl
  if (!reference.deepLink) return base

  try {
    return new URL(reference.deepLink, base).toString()
  } catch {
    return base
  }
}

function resolveSources(chapter: ChapterPackage, references: SourceReference[]): ResolvedSource[] {
  return references.flatMap((reference) => {
    const definition = chapter.sources.find((source) => source.id === reference.sourceId)
    if (!definition) return []

    return [{
      definition,
      reference,
      href: resolveHref(definition, reference),
      canEmbed: definition.kind === 'bundled' || definition.embed === 'attempt',
    }]
  })
}

export const SourceDialog = forwardRef<HTMLDialogElement, SourceDialogProps>(function SourceDialog(
  { chapter, sourceRefs, onRequestClose },
  ref,
) {
  const sources = useMemo(() => resolveSources(chapter, sourceRefs), [chapter, sourceRefs])
  const sourceSignature = sources.map(({ definition, reference, href }) => (
    `${definition.id}:${reference.label}:${href}`
  )).join('|')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [chapter.id, sourceSignature])

  const activeSource = sources[Math.min(activeIndex, Math.max(sources.length - 1, 0))]

  return (
    <dialog
      className="source-dialog"
      ref={ref}
      aria-labelledby="source-title"
      onCancel={(event) => { event.preventDefault(); onRequestClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onRequestClose() }}
    >
      <header className="dialog__header">
        <button className="dialog__back" type="button" onClick={onRequestClose} aria-label="返回上一界面">
          <ArrowLeft aria-hidden="true" /><span>返回</span>
        </button>
        <div>
          <p>{activeSource?.reference.label ?? '原文'}</p>
          <h2 id="source-title">{chapter.title}原文</h2>
        </div>
      </header>

      <div className="source-dialog__body">
        {sources.length > 1 && (
          <div className="source-dialog__tabs" aria-label="选择原文来源">
            {sources.map((source, index) => (
              <button
                className={index === activeIndex ? 'source-tab is-active' : 'source-tab'}
                key={`${source.definition.id}:${source.reference.label}`}
                type="button"
                aria-pressed={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              >
                {source.reference.label}
              </button>
            ))}
          </div>
        )}

        {!activeSource && (
          <p className="source-dialog__empty" role="status">本关暂未关联原文。</p>
        )}

        {activeSource?.canEmbed && (
          <iframe
            id="source-document"
            key={activeSource.href}
            title={`${chapter.title}：${activeSource.reference.label}`}
            src={activeSource.href}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}

        {activeSource && (
          <div className="source-dialog__fallback">
            <p>
              {activeSource.canEmbed
                ? '若原文未能在此处显示，请单独打开。'
                : '此来源需要在原网站中阅读。'}
            </p>
            <a href={activeSource.href} target="_blank" rel="noreferrer">
              打开原文 <ExternalLink aria-hidden="true" />
            </a>
            {activeSource.definition.kind === 'remote' && (
              <p className="source-dialog__privacy">
                若原网站要求密码，请只在原网站页面输入；本应用不会读取或保存密码。
              </p>
            )}
          </div>
        )}
      </div>
    </dialog>
  )
})
