import { ArrowRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StageRef } from '../types'

export type CourseSearchItem = {
  ref: StageRef
  chapterTitle: string
  unitTitle: string
  title: string
  outcome: string
  concepts: string[]
}

type CourseSearchDialogProps = {
  items: CourseSearchItem[]
  open: boolean
  onClose: () => void
  onSelect: (ref: StageRef) => void
}

function normalize(value: string) {
  return value.replace(/\s+/g, '').toLocaleLowerCase()
}

export function CourseSearchDialog({ items, open, onClose, onSelect }: CourseSearchDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeTimer = useRef<number | null>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [closing, setClosing] = useState(false)
  const normalizedQuery = normalize(query)
  const results = useMemo(() => {
    if (!normalizedQuery) return items.slice(0, 12)
    return items.filter((item) => normalize([
      item.chapterTitle,
      item.unitTitle,
      item.title,
      item.outcome,
      ...item.concepts,
    ].join(' ')).includes(normalizedQuery)).slice(0, 12)
  }, [items, normalizedQuery])

  useEffect(() => {
    if (!open) return
    setClosing(false)
    setQuery('')
    setActiveIndex(0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, results.length - 1)))
  }, [results.length])

  const requestClose = (afterClose?: () => void) => {
    if (closing) return
    setClosing(true)
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    closeTimer.current = window.setTimeout(() => {
      afterClose?.()
      onClose()
      setClosing(false)
    }, reducedMotion ? 150 : 320)
  }

  if (!open) return null

  const choose = (item: CourseSearchItem | undefined) => {
    if (!item) return
    requestClose(() => onSelect(item.ref))
  }

  return (
    <div className={`course-search ${closing ? 'is-closing' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
      <section ref={dialogRef} className="course-search__dialog" role="dialog" aria-modal="true" aria-labelledby="course-search-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); requestClose() }
        if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((current) => Math.min(current + 1, results.length - 1)) }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)) }
        if (event.key === 'Enter') { event.preventDefault(); choose(results[activeIndex]) }
        if (event.key === 'Tab') {
          const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') ?? [])]
          const first = focusable[0]
          const last = focusable.at(-1)
          if (event.shiftKey && document.activeElement === first && last) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last && first) {
            event.preventDefault()
            first.focus()
          }
        }
      }}>
        <header className="course-search__head">
          <Search aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课程、概念或学习目标" aria-label="搜索课程" />
          <button className="icon-button icon-button--quiet" type="button" onClick={() => requestClose()} aria-label="关闭课程搜索"><X aria-hidden="true" /></button>
        </header>
        <div className="course-search__title"><h2 id="course-search-title">课程搜索</h2><span>{query ? `${results.length} 项结果` : '输入关键词开始查找'}</span></div>
        <ol className="course-search__results" aria-label="搜索结果">
          {results.map((item, index) => (
            <li key={`${item.ref.chapterId}:${item.ref.stageId}`}>
              <button className={index === activeIndex ? 'is-active' : ''} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item)}>
                <span><small>{item.chapterTitle} · {item.unitTitle}</small><strong>{item.title}</strong><em>{item.outcome}</em></span>
                <ArrowRight aria-hidden="true" />
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="course-search__empty">没有匹配的课程内容。</li>}
        </ol>
        <footer><span><kbd>↑↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></footer>
      </section>
    </div>
  )
}
