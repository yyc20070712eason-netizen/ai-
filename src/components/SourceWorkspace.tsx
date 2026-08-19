import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Highlighter, MessageSquareText, Minus, MoreHorizontal, PenLine, Plus, Search, Trash2, Undo2, X } from 'lucide-react'
import type { AiAnswer, ArtifactColor, ChapterPackage, LearningArtifact, SourceReference, StageRef, WorkspaceDocument } from '../types'
import { makeStageKey } from '../content/schema'
import { askAi, deleteArtifact, getDocumentHtml, getDocumentPages, listAiAnswers, listArtifacts, saveArtifact, WorkspaceApiError } from '../lib/workspace'
import { normalizeExtractedPdfText } from '../lib/pdfText'
import { PdfPage } from './PdfPage'
import { clientRelease } from '../release'
import { loadPdfRuntime, supportsEnhancedPdfRenderer } from '../lib/pdfRuntime'
import type { PdfDocument, PdfRuntime } from '../lib/pdfRuntime'
import { locateSourceTarget } from '../lib/sourceNavigation'
import { findTextRange, findUniqueTextAnchor } from '../lib/textAnchors'
import { ARTIFACT_COLORS, clearAnnotationDraft, loadArtifactColorPreferences, readAnnotationDraft, saveAnnotationDraft, saveArtifactColorPreference } from '../lib/artifactPreferences'
import { renderArtifactHighlights } from '../lib/artifactHighlights'

type SourceWorkspaceProps = {
  chapter: Pick<ChapterPackage, 'id' | 'title'>
  document: WorkspaceDocument
  stageRef?: StageRef
  stageTitle?: string
  sourceRefs?: SourceReference[]
  stageNote?: string
  onRequestKeyUpdate?: () => void
}

type SelectionState = { quote: string; blockId: string; page?: number; start: number; end: number }
type RightPanelTab = 'annotations' | 'ai'
type ArtifactMenuState = { artifact: LearningArtifact; top: number; left: number; placement: 'above' | 'below' }
const EMPTY_SOURCE_REFS: SourceReference[] = []
const COLOR_LABELS: Record<ArtifactColor, string> = { yellow: '黄色', green: '绿色', blue: '蓝色', pink: '粉色', purple: '紫色' }

function defaultColor(type: LearningArtifact['type']): ArtifactColor { return type === 'annotation' ? 'blue' : 'yellow' }
function artifactColor(artifact: LearningArtifact): ArtifactColor { return artifact.color ?? defaultColor(artifact.type) }
function draftKey(documentId: string, selection: SelectionState) { return `${documentId}:${selection.page ?? 'html'}:${selection.start}:${selection.end}` }

export function SourceWorkspace({ chapter, document, stageRef, stageTitle = '', sourceRefs = EMPTY_SOURCE_REFS, stageNote, onRequestKeyUpdate }: SourceWorkspaceProps) {
  const [pages, setPages] = useState<Array<{ page: number; text: string }>>([])
  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [pdfRuntime, setPdfRuntime] = useState<PdfRuntime | null>(null)
  const [html, setHtml] = useState('')
  const [artifacts, setArtifacts] = useState<LearningArtifact[]>([])
  const [answers, setAnswers] = useState<AiAnswer[]>([])
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [annotation, setAnnotation] = useState('')
  const [annotationOpen, setAnnotationOpen] = useState(false)
  const [editingAnnotationId, setEditingAnnotationId] = useState('')
  const [annotationDirty, setAnnotationDirty] = useState(false)
  const [annotationStatus, setAnnotationStatus] = useState<'idle' | 'saving' | 'saved' | 'retrying' | 'invalid' | 'failed'>('idle')
  const [annotationRetryToken, setAnnotationRetryToken] = useState(0)
  const [question, setQuestion] = useState('')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [zoom, setZoom] = useState(1)
  const [readerMode, setReaderMode] = useState<'enhanced' | 'compatibility'>('enhanced')
  const [openPanel, setOpenPanel] = useState<'outline' | 'ai' | null>(null)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('annotations')
  const [openArtifactMenuId, setOpenArtifactMenuId] = useState('')
  const [artifactMenu, setArtifactMenu] = useState<ArtifactMenuState | null>(null)
  const [relocatingArtifact, setRelocatingArtifact] = useState<LearningArtifact | null>(null)
  const [lastDeletedArtifact, setLastDeletedArtifact] = useState<LearningArtifact | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [artifactMessage, setArtifactMessage] = useState('')
  const [lastSavedArtifactId, setLastSavedArtifactId] = useState('')
  const [highlightColor, setHighlightColor] = useState<ArtifactColor>(() => loadArtifactColorPreferences().highlight)
  const [annotationColor, setAnnotationColor] = useState<ArtifactColor>(() => loadArtifactColorPreferences().annotation)
  const contentRef = useRef<HTMLDivElement>(null)
  const htmlRef = useRef<HTMLElement>(null)
  const htmlHighlightLayerRef = useRef<HTMLDivElement>(null)
  const pendingJumpPage = useRef<number | null>(null)
  const pendingHtmlQuote = useRef('')
  const artifactMenuRef = useRef<HTMLDivElement>(null)
  const artifactMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const stageKey = stageRef ? makeStageKey(stageRef) : undefined
  const enhancedPdfSupported = supportsEnhancedPdfRenderer()

  useEffect(() => {
    setOpenPanel(null)
    setRightPanelTab('annotations')
    setOpenArtifactMenuId('')
    setArtifactMenu(null)
    setRelocatingArtifact(null)
    setLastDeletedArtifact(null)
    setArtifactMessage('')
    setLastSavedArtifactId('')
    setError('')
    setErrorCode('')
    setAnnotation('')
    setAnnotationOpen(false)
    setEditingAnnotationId('')
    setAnnotationDirty(false)
    setAnnotationStatus('idle')
    setCurrentPage(1)
    setPageInput('1')
    pendingJumpPage.current = null
    pendingHtmlQuote.current = ''
  }, [document.id])

  useEffect(() => {
    const retry = () => setAnnotationRetryToken((value) => value + 1)
    window.addEventListener('focus', retry)
    window.addEventListener('online', retry)
    return () => { window.removeEventListener('focus', retry); window.removeEventListener('online', retry) }
  }, [])

  useEffect(() => {
    if (!openPanel) return
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [openPanel])

  useEffect(() => {
    if (!openArtifactMenuId) return
    const closeForOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (artifactMenuRef.current?.contains(target) || artifactMenuTriggerRef.current?.contains(target)) return
      closeArtifactMenu(true)
    }
    const closeForEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeArtifactMenu(true)
    }
    const closeForScroll = () => closeArtifactMenu()
    window.addEventListener('pointerdown', closeForOutsidePointer)
    window.addEventListener('keydown', closeForEscape)
    window.addEventListener('scroll', closeForScroll, true)
    return () => {
      window.removeEventListener('pointerdown', closeForOutsidePointer)
      window.removeEventListener('keydown', closeForEscape)
      window.removeEventListener('scroll', closeForScroll, true)
    }
  }, [openArtifactMenuId])

  useEffect(() => {
    let active = true
    Promise.all([
      document.kind === 'pdf'
        ? getDocumentPages(document.id).then((value) => ({ pages: value.map((page) => ({ ...page, text: normalizeExtractedPdfText(page.text) })), html: '' }))
        : Promise.all([getDocumentPages(document.id), getDocumentHtml(document.id)]).then(([pageItems, value]) => ({
          pages: pageItems.map((page) => ({ ...page, text: normalizeExtractedPdfText(page.text) })),
          html: value.html,
        })),
      listArtifacts(chapter.id),
      listAiAnswers(chapter.id, stageKey),
    ]).then(async ([content, artifactItems, answerItems]) => {
      if (!active) return
      setPages(content.pages)
      setHtml(content.html)
      const relevantArtifacts = artifactItems.filter((item) => item.anchor.kind !== 'document' || item.anchor.documentId === document.id)
      const htmlText = content.html ? new DOMParser().parseFromString(content.html, 'text/html').body.innerText : ''
      const reconciledArtifacts = await Promise.all(relevantArtifacts.map(async (artifact) => {
        if (artifact.anchor.kind !== 'document') return artifact
        const anchor = artifact.anchor
        const text = anchor.page ? content.pages.find((page) => page.page === anchor.page)?.text ?? '' : htmlText
        const exact = text.slice(anchor.start, anchor.end) === anchor.quote
        const recovered = exact ? { start: anchor.start, end: anchor.end } : findUniqueTextAnchor(text, anchor.quote)
        const needsRelocation = !recovered
        if (exact && !artifact.needsRelocation) return artifact
        if (needsRelocation === Boolean(artifact.needsRelocation) && (!recovered || (recovered.start === anchor.start && recovered.end === anchor.end))) return artifact
        return saveArtifact({
          ...artifact,
          needsRelocation,
          anchor: recovered ? { ...anchor, start: recovered.start, end: recovered.end } : anchor,
        })
      }))
      if (!active) return
      setArtifacts(reconciledArtifacts)
      setAnswers(answerItems)
      const target = locateSourceTarget(content.pages, sourceRefs, stageTitle)
      if (target && document.kind === 'pdf') {
        pendingJumpPage.current = target.page
        setCurrentPage(target.page)
        setPageInput(String(target.page))
        setArtifactMessage(`已定位到本关对应原文 · 第 ${target.page} 页`)
      } else if (target) {
        pendingHtmlQuote.current = target.quote
        setArtifactMessage('已定位到本关对应原文')
      }
    }).catch((reason: Error) => active && setError(reason.message))
    return () => { active = false }
  }, [chapter.id, document.id, document.kind, sourceRefs, stageKey, stageTitle])

  useEffect(() => {
    if (document.kind !== 'pdf') return
    let active = true
    let task: ReturnType<PdfRuntime['getDocument']> | undefined
    setPdf(null)
    setPdfRuntime(null)
    setError('')
    setReaderMode(enhancedPdfSupported ? 'enhanced' : 'compatibility')
    if (!enhancedPdfSupported) return () => { active = false }
    void fetch(`/api/documents/${encodeURIComponent(document.id)}/content`)
      .then((response) => {
        if (!response.ok) throw new Error(`PDF 读取失败（${response.status}）`)
        return response.arrayBuffer()
      })
      .then(async (buffer) => {
        const runtime = await loadPdfRuntime(clientRelease.buildId)
        task = runtime.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isOffscreenCanvasSupported: false })
        return { runtime, pdf: await task.promise }
      })
      .then((value) => {
        if (active) {
          setPdfRuntime(value.runtime)
          setPdf(value.pdf)
        }
        else void task?.destroy()
      })
      .catch((reason: Error) => active && setError(/version.+match/i.test(reason.message)
        ? 'PDF 组件版本不匹配。请从桌面“AI 学习计划”图标重新打开应用。'
        : reason.message))
    return () => {
      active = false
      if (task) void task.destroy()
    }
  }, [document.id, document.kind, enhancedPdfSupported])

  const handleVisiblePage = useCallback((page: number) => {
    setCurrentPage(page)
    setPageInput(String(page))
  }, [])

  const pageCount = pdf?.numPages ?? document.pageCount

  useEffect(() => {
    const page = pendingJumpPage.current
    if (!pdf || readerMode !== 'enhanced' || !page) return
    const frame = window.requestAnimationFrame(() => {
      window.document.getElementById(`source-page-${page}`)?.scrollIntoView({ block: 'center' })
      pendingJumpPage.current = null
    })
    return () => window.cancelAnimationFrame(frame)
  }, [currentPage, pdf, readerMode])

  useEffect(() => {
    if (document.kind === 'pdf') return
    const relevant = artifacts.filter((artifact) => artifact.anchor.kind === 'document' && artifact.anchor.documentId === document.id)
    const frame = window.requestAnimationFrame(() => {
      renderArtifactHighlights(htmlRef.current, htmlHighlightLayerRef.current, relevant)
      const quote = pendingHtmlQuote.current
      const range = quote && htmlRef.current ? findTextRange(htmlRef.current, quote) : null
      const target = range?.startContainer.parentElement
      if (target) {
        target.scrollIntoView({ block: 'start' })
        pendingHtmlQuote.current = ''
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [artifacts, document.id, document.kind, html])

  const jumpToPage = useCallback((rawPage: number) => {
    const page = Math.min(Math.max(Math.round(rawPage) || 1, 1), Math.max(1, pageCount))
    setCurrentPage(page)
    setPageInput(String(page))
    window.document.getElementById(`source-page-${page}`)?.scrollIntoView({ block: 'center' })
  }, [pageCount])

  function captureSelection(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.selection-tools')) return
    const rangeSelection = window.getSelection()
    const quote = normalizeExtractedPdfText(rangeSelection?.toString().trim() ?? '')
    if (!quote || !contentRef.current || !rangeSelection?.anchorNode || !contentRef.current.contains(rangeSelection.anchorNode)) {
      setSelection(null)
      return
    }
    const anchorElement = rangeSelection.anchorNode.nodeType === Node.ELEMENT_NODE
      ? rangeSelection.anchorNode as Element
      : rangeSelection.anchorNode.parentElement
    const element = anchorElement?.closest<HTMLElement>('[data-block-id]')
    if (!element) return
    const selectedRange = rangeSelection.getRangeAt(0)
    const textRoot = element.querySelector<HTMLElement>('.textLayer') ?? element
    const prefix = window.document.createRange()
    prefix.selectNodeContents(textRoot)
    prefix.setEnd(selectedRange.startContainer, selectedRange.startOffset)
    const start = normalizeExtractedPdfText(prefix.toString()).length
    const nextSelection = { quote, blockId: element.dataset.blockId ?? 'document', page: element.dataset.page ? Number(element.dataset.page) : undefined, start, end: start + quote.length }
    const existingAnnotation = artifacts.find((artifact) => artifact.type === 'annotation' && artifact.anchor.kind === 'document'
      && artifact.anchor.documentId === document.id && artifact.anchor.page === nextSelection.page && artifact.anchor.quote === nextSelection.quote)
    setSelection(nextSelection)
    if (existingAnnotation) {
      setEditingAnnotationId(existingAnnotation.id)
      setAnnotation(existingAnnotation.note ?? '')
      setAnnotationColor(artifactColor(existingAnnotation))
      setAnnotationOpen(true)
      setAnnotationDirty(false)
      setAnnotationStatus('saved')
      setRightPanelTab('annotations')
      setOpenPanel('ai')
    } else {
      const draft = readAnnotationDraft(draftKey(document.id, nextSelection))
      setEditingAnnotationId(draft?.artifactId ?? '')
      setAnnotation(draft?.note ?? '')
      setAnnotationColor(draft?.color ?? loadArtifactColorPreferences().annotation)
      setAnnotationOpen(Boolean(draft))
      setAnnotationDirty(Boolean(draft))
      setAnnotationStatus(draft ? 'retrying' : 'idle')
      if (draft) {
        setRightPanelTab('annotations')
        setOpenPanel('ai')
      }
    }
  }

  async function persistArtifact(type: 'highlight' | 'annotation', options: { id?: string, note?: string, color?: ArtifactColor, existing?: LearningArtifact } = {}) {
    if (!selection) return
    const duplicate = artifacts.find((artifact) => artifact.type === type
      && artifact.anchor.kind === 'document'
      && artifact.anchor.documentId === document.id
      && artifact.anchor.page === selection.page
      && artifact.anchor.quote === selection.quote)
    if (duplicate && duplicate.id !== options.id) {
      setArtifactMessage(`${type === 'highlight' ? '重点' : '批注'}已存在，无需重复保存`)
      setLastSavedArtifactId('')
      return
    }
    setBusy(type)
    setError('')
    setArtifactMessage('')
    try {
      const artifact = await saveArtifact({
        chapterId: chapter.id,
        stageKey,
        type,
        anchor: { kind: 'document', documentId: document.id, page: selection.page, blockId: selection.blockId, start: selection.start, end: selection.end, quote: selection.quote },
        color: options.color ?? (type === 'annotation' ? annotationColor : highlightColor),
        ...(options.id ? { id: options.id } : {}),
        ...(options.existing ? { createdAt: options.existing.createdAt, needsRelocation: false } : {}),
        ...(type === 'annotation' ? { note: (options.note ?? annotation).trim() } : {}),
      })
      setArtifacts((items) => items.some((item) => item.id === artifact.id)
        ? items.map((item) => item.id === artifact.id ? artifact : item)
        : [...items, artifact])
      setArtifactMessage(`${type === 'highlight' ? '重点' : '批注'}已保存到本机${selection.page ? ` · 第 ${selection.page} 页` : ''}`)
      setLastSavedArtifactId(artifact.id)
      if (options.existing) {
        setRelocatingArtifact(null)
        setArtifactMessage(`已重新定位${type === 'highlight' ? '重点' : '批注'}${selection.page ? ` · 第 ${selection.page} 页` : ''}`)
      }
      if (type === 'annotation') {
        const key = draftKey(document.id, selection)
        clearAnnotationDraft(key)
        setEditingAnnotationId(artifact.id)
        setAnnotation(artifact.note ?? '')
        setAnnotationDirty(false)
        setAnnotationStatus('saved')
      } else {
        setSelection(null)
        window.getSelection()?.removeAllRanges()
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败。')
      if (type === 'annotation') setAnnotationStatus('failed')
    }
    finally { setBusy('') }
  }

  useEffect(() => {
    if (!selection || !annotationOpen || !annotationDirty) return
    const note = annotation.trim()
    const key = draftKey(document.id, selection)
    if (!note) {
      setAnnotationStatus('invalid')
      return
    }
    saveAnnotationDraft(key, { note: annotation, color: annotationColor, ...(editingAnnotationId ? { artifactId: editingAnnotationId } : {}) })
    const timer = window.setTimeout(() => {
      setAnnotationStatus('saving')
      void persistArtifact('annotation', { id: editingAnnotationId || undefined, note, color: annotationColor }).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  // The save helper deliberately owns the API error state; changes above are the retry triggers.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [annotation, annotationColor, annotationDirty, annotationOpen, annotationRetryToken, editingAnnotationId, selection, document.id])

  async function updateArtifactColor(artifact: LearningArtifact, color: ArtifactColor) {
    setBusy(`color:${artifact.id}`)
    setError('')
    try {
      const updated = await saveArtifact({ ...artifact, color, ...(artifact.type === 'annotation' ? { note: artifact.note ?? '' } : {}) })
      setArtifacts((items) => items.map((item) => item.id === updated.id ? updated : item))
      saveArtifactColorPreference(artifact.type, color)
      setArtifactMessage(`${artifact.type === 'highlight' ? '重点' : '批注'}已改为${COLOR_LABELS[color]}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '颜色保存失败。') }
    finally { setBusy('') }
  }

  function openAnnotationEditor() {
    if (!selection) return
    setAnnotationOpen(true)
    setAnnotationStatus(annotation.trim() ? 'saved' : 'idle')
    setRightPanelTab('annotations')
    setOpenPanel('ai')
  }

  function changeAnnotation(value: string) {
    setAnnotation(value)
    setAnnotationDirty(true)
    setAnnotationStatus(value.trim() ? 'retrying' : 'invalid')
  }

  function colorSwatches(type: 'highlight' | 'annotation', selected: ArtifactColor, onChange: (color: ArtifactColor) => void, label: string, menuItemRadio = false) {
    return <div className="artifact-color-picker" role="group" aria-label={label}>
      {ARTIFACT_COLORS.map((color) => <button key={color} type="button" className={`artifact-color-swatch is-${color} ${selected === color ? 'is-selected' : ''}`} aria-label={`选择${COLOR_LABELS[color]}`} title={COLOR_LABELS[color]} {...(menuItemRadio ? { role: 'menuitemradio', 'aria-checked': selected === color } : {})} onPointerDown={(event) => event.preventDefault()} onClick={() => {
        onChange(color)
        saveArtifactColorPreference(type, color)
      }} />)}
    </div>
  }

  function annotationStatusLabel() {
    return { idle: '输入后自动保存到本机', saving: '保存中…', saved: '已保存到本机', retrying: '等待自动保存', invalid: '批注不能为空', failed: '保存失败，正在保留草稿' }[annotationStatus]
  }

  async function removeArtifact(artifact: LearningArtifact) {
    setBusy(`delete:${artifact.id}`)
    setError('')
    try {
      await deleteArtifact(artifact.id)
      setArtifacts((items) => items.filter((item) => item.id !== artifact.id))
      setLastDeletedArtifact(artifact)
      setLastSavedArtifactId((value) => value === artifact.id ? '' : value)
      if (relocatingArtifact?.id === artifact.id) setRelocatingArtifact(null)
      if (editingAnnotationId === artifact.id) {
        setEditingAnnotationId('')
        setAnnotationOpen(false)
      }
      setArtifactMessage(`${artifact.type === 'highlight' ? '重点' : '批注'}已取消`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '取消失败，学习痕迹仍保留在本机。')
    } finally {
      setBusy('')
    }
  }

  async function undoDeleteArtifact() {
    if (!lastDeletedArtifact) return
    setBusy(`restore:${lastDeletedArtifact.id}`)
    setError('')
    try {
      const restored = await saveArtifact(lastDeletedArtifact)
      setArtifacts((items) => items.some((item) => item.id === restored.id) ? items : [...items, restored])
      setLastDeletedArtifact(null)
      setArtifactMessage(`${restored.type === 'highlight' ? '重点' : '批注'}已恢复`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '恢复失败，重点仍可从原文重新创建。')
    } finally { setBusy('') }
  }

  async function submitQuestion(value = question) {
    const trimmed = value.trim()
    if (!trimmed) return
    setRightPanelTab('ai')
    setOpenPanel('ai')
    setBusy('ask')
    setError('')
    setErrorCode('')
    try {
      const answer = await askAi({ chapterId: chapter.id, stageKey, question: trimmed, selection: selection?.quote, note: stageNote })
      setAnswers((items) => [...items, answer])
      setQuestion('')
      setSelection(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI 暂时无法回答。')
      setErrorCode(reason instanceof WorkspaceApiError ? reason.code ?? '' : '')
    }
    finally { setBusy('') }
  }

  const normalizedQuery = normalizeExtractedPdfText(query).toLowerCase()
  const matches = normalizedQuery
    ? pages.filter((page) => page.text.toLowerCase().includes(normalizedQuery))
    : []
  const highlightArtifacts = artifacts.filter((artifact) => artifact.type === 'highlight')
  const annotationArtifacts = artifacts.filter((artifact) => artifact.type === 'annotation')

  function closeArtifactMenu(restoreFocus = false) {
    setOpenArtifactMenuId('')
    setArtifactMenu(null)
    if (restoreFocus) window.requestAnimationFrame(() => artifactMenuTriggerRef.current?.focus())
  }

  function openArtifactMenu(artifact: LearningArtifact, trigger: HTMLButtonElement) {
    const rect = trigger.getBoundingClientRect()
    const safeInset = 8
    const estimatedHeight = 252
    const width = Math.min(236, Math.max(184, window.innerWidth - safeInset * 2))
    const placement = window.innerHeight - rect.bottom >= estimatedHeight || rect.top < estimatedHeight ? 'below' : 'above'
    const top = placement === 'below'
      ? Math.min(window.innerHeight - safeInset, rect.bottom + 4)
      : Math.max(safeInset, rect.top - 4)
    const left = Math.min(Math.max(safeInset, rect.right - width), window.innerWidth - width - safeInset)
    artifactMenuTriggerRef.current = trigger
    setArtifactMenu({ artifact, top, left, placement })
    setOpenArtifactMenuId(artifact.id)
  }

  function startRelocation(artifact: LearningArtifact) {
    if (artifact.anchor.kind !== 'document') return
    if (document.kind === 'pdf' && readerMode === 'compatibility') {
      setError('兼容模式无法选择文字；请切回增强阅读后重新定位。')
      closeArtifactMenu(true)
      return
    }
    setRelocatingArtifact(artifact)
    setSelection(null)
    setAnnotationOpen(false)
    setArtifactMessage('重新定位：请在原文中选中正确文字，再点击“绑定到此处”。')
    closeArtifactMenu(true)
    if (artifact.anchor.page) jumpToPage(artifact.anchor.page)
  }

  function cancelRelocation() {
    setRelocatingArtifact(null)
    setSelection(null)
    setArtifactMessage('已取消重新定位；原记录保持不变。')
  }

  function editAnnotation(artifact: LearningArtifact) {
    if (artifact.type !== 'annotation' || artifact.anchor.kind !== 'document') return
    setSelection({ quote: artifact.anchor.quote, blockId: artifact.anchor.blockId, page: artifact.anchor.page, start: artifact.anchor.start, end: artifact.anchor.end })
    setEditingAnnotationId(artifact.id)
    setAnnotation(artifact.note ?? '')
    setAnnotationColor(artifactColor(artifact))
    setAnnotationOpen(true)
    setAnnotationDirty(false)
    setAnnotationStatus('saved')
    setRightPanelTab('annotations')
    setOpenPanel('ai')
    closeArtifactMenu()
    if (artifact.anchor.page) jumpToPage(artifact.anchor.page)
  }

  function artifactActionMenu(artifact: LearningArtifact) {
    const isOpen = openArtifactMenuId === artifact.id
    const label = artifact.type === 'highlight' ? '重点' : '批注'
    return <button
        type="button"
        className="source-artifact-actions__toggle"
        aria-label={`${label}操作`}
        title={`${label}操作`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(event) => {
          if (isOpen) closeArtifactMenu()
          else openArtifactMenu(artifact, event.currentTarget)
        }}
      ><MoreHorizontal aria-hidden="true" /></button>
  }

  const renderArtifactMenu = () => {
    if (!artifactMenu || typeof globalThis.document === 'undefined') return null
    const { artifact, top, left, placement } = artifactMenu
    const label = artifact.type === 'highlight' ? '重点' : '批注'
    const focusMenuItem = (direction: 'first' | 'last' | 'next' | 'previous') => {
      const items = Array.from(artifactMenuRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
      if (!items.length) return
      const current = items.indexOf(window.document.activeElement as HTMLElement)
      const index = direction === 'first' ? 0 : direction === 'last' ? items.length - 1 : direction === 'next' ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length
      items[index]?.focus()
    }
    return createPortal(
      <div
        ref={artifactMenuRef}
        className={`source-artifact-actions__menu is-portal is-${placement}`}
        role="menu"
        aria-label={`${label}操作菜单`}
        style={{ top, left }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); focusMenuItem('next') }
          if (event.key === 'ArrowUp') { event.preventDefault(); focusMenuItem('previous') }
          if (event.key === 'Home') { event.preventDefault(); focusMenuItem('first') }
          if (event.key === 'End') { event.preventDefault(); focusMenuItem('last') }
        }}
      >
        <span>颜色</span>
        {colorSwatches(artifact.type, artifactColor(artifact), (color) => {
          closeArtifactMenu()
          void updateArtifactColor(artifact, color)
        }, `更改${label}颜色`, true)}
        {artifact.needsRelocation && <button type="button" role="menuitem" onClick={() => startRelocation(artifact)}><Search aria-hidden="true" />重新定位</button>}
        {artifact.type === 'annotation' && <button type="button" role="menuitem" onClick={() => editAnnotation(artifact)}><PenLine aria-hidden="true" />编辑批注</button>}
        <button type="button" role="menuitem" className="is-danger" onClick={() => {
          closeArtifactMenu()
          void removeArtifact(artifact)
        }} disabled={Boolean(busy)}><Trash2 aria-hidden="true" />删除{label}</button>
      </div>,
      globalThis.document.body,
    )
  }

  return (
    <div className="source-workspace">
      <header className={`source-workspace__topbar ${document.kind === 'pdf' && readerMode === 'enhanced' ? 'has-controls' : ''}`}>
        <div className="source-workspace__title"><small>{chapter.title} · 本地原文</small><strong>{document.name}</strong></div>
        {document.kind === 'pdf' && readerMode === 'enhanced' && (
          <div className="source-workspace__controls" aria-label="PDF 阅读控制">
            <button type="button" onClick={() => jumpToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="上一页"><ChevronLeft aria-hidden="true" /></button>
            <label><span className="sr-only">当前页</span><input inputMode="numeric" value={pageInput} onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ''))} onBlur={() => jumpToPage(Number(pageInput))} onKeyDown={(event) => { if (event.key === 'Enter') jumpToPage(Number(pageInput)) }} /></label>
            <span>/ {pageCount}</span>
            <button type="button" onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="下一页"><ChevronRight aria-hidden="true" /></button>
            <i aria-hidden="true" />
            <button type="button" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))} disabled={zoom <= 0.75} aria-label="缩小"><Minus aria-hidden="true" /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + 0.25))} disabled={zoom >= 1.5} aria-label="放大"><Plus aria-hidden="true" /></button>
            <button type="button" onClick={() => setReaderMode('compatibility')}>兼容模式</button>
          </div>
        )}
        <div className="source-workspace__actions">
          <button className="icon-button source-workspace__panel-toggle is-outline" type="button" onClick={() => setOpenPanel((value) => value === 'outline' ? null : 'outline')} aria-label="打开原文搜索" aria-controls="source-outline" aria-expanded={openPanel === 'outline'}><Search aria-hidden="true" /><span>搜索</span></button>
          <button className="icon-button source-workspace__panel-toggle is-ai" type="button" onClick={() => setOpenPanel((value) => value === 'ai' ? null : 'ai')} aria-label="打开批注与原文追问" aria-controls="source-ai" aria-expanded={openPanel === 'ai'}><MessageSquareText aria-hidden="true" /><span>批注</span></button>
          <a className="source-workspace__original" href={`/api/documents/${document.id}/content`} target="_blank" rel="noreferrer"><BookOpen aria-hidden="true" /><span>新窗口打开</span></a>
        </div>
      </header>

      <div className="source-workspace__body">
        <button className={`source-drawer-backdrop ${openPanel ? `is-open is-${openPanel}` : ''}`} type="button" aria-label="关闭原文工具栏" tabIndex={openPanel ? 0 : -1} onClick={() => setOpenPanel(null)} />
        <aside id="source-outline" className={`source-outline ${openPanel === 'outline' ? 'is-open' : ''}`}>
          <button className="icon-button source-panel__close" type="button" onClick={() => setOpenPanel(null)} aria-label="关闭原文搜索"><X aria-hidden="true" /></button>
          <label className="source-search"><Search aria-hidden="true" /><span className="sr-only">搜索原文</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索这份原文" /></label>
          <p>{pageCount} 页 · {highlightArtifacts.length} 条重点</p>
          {artifactMessage && <div className="source-outline__message" role="status"><span>{artifactMessage}</span>{lastSavedArtifactId && artifacts.some((artifact) => artifact.id === lastSavedArtifactId) && <button type="button" onClick={() => { const artifact = artifacts.find((item) => item.id === lastSavedArtifactId); if (artifact) void removeArtifact(artifact) }} disabled={Boolean(busy)}><Undo2 aria-hidden="true" />撤销</button>}</div>}
          {normalizedQuery && (
            <section className="source-outline__results" aria-live="polite">
              <strong>{matches.length ? `${matches.length} 页包含结果` : '没有找到'}</strong>
              {matches.slice(0, 24).map((page) => {
                const index = page.text.toLowerCase().indexOf(normalizedQuery)
                const excerpt = page.text.slice(Math.max(0, index - 24), index + normalizedQuery.length + 58)
                return <button type="button" key={page.page} onClick={() => { jumpToPage(page.page); setOpenPanel(null) }}><span>第 {page.page} 页</span><small>{excerpt}</small></button>
              })}
            </section>
          )}
          {!normalizedQuery && highlightArtifacts.length > 0 && (
            <section className="source-outline__notes">
              <strong>重点</strong>
              {highlightArtifacts.map((artifact) => (
                <div className={`source-outline__note-row ${artifact.needsRelocation ? 'needs-relocation' : ''}`} key={artifact.id}>
                  <button type="button" className="source-outline__note-open" onClick={() => artifact.anchor.kind === 'document' && artifact.anchor.page && jumpToPage(artifact.anchor.page)}>
                    <span>{artifact.needsRelocation ? '待重新定位' : '重点'}{artifact.anchor.kind === 'document' && artifact.anchor.page ? ` · 第 ${artifact.anchor.page} 页` : ''}</span>
                    <q>{artifact.anchor.quote}</q>
                  </button>
                  <div className="source-artifact-actions">{artifactActionMenu(artifact)}</div>
                </div>
              ))}
            </section>
          )}
          {!normalizedQuery && highlightArtifacts.length === 0 && <p className="source-outline__empty">选中文字后，可保存重点；批注会显示在右侧。</p>}
        </aside>

        <section className={`source-reader ${document.kind === 'pdf' && readerMode === 'compatibility' ? 'is-compatibility' : ''}`} ref={contentRef} onMouseUp={captureSelection} aria-label="原文阅读区">
          {relocatingArtifact && <div className="source-reader__relocation" role="status"><span>正在重新定位：选中正确文字后点击“绑定到此处”。</span><button type="button" onClick={cancelRelocation}>取消</button></div>}
          {artifactMessage && <div className="source-reader__message" role="status"><span>{artifactMessage}</span>{lastSavedArtifactId && artifacts.some((artifact) => artifact.id === lastSavedArtifactId) && <button type="button" onClick={() => { const artifact = artifacts.find((item) => item.id === lastSavedArtifactId); if (artifact) void removeArtifact(artifact) }} disabled={Boolean(busy)}><Undo2 aria-hidden="true" />撤销</button>}</div>}
          {selection && (
            <div className="selection-tools" role="toolbar" aria-label="选中文字工具">
              <span>“{selection.quote.slice(0, 38)}{selection.quote.length > 38 ? '…' : ''}”</span>
              {!relocatingArtifact && colorSwatches('highlight', highlightColor, setHighlightColor, '重点颜色')}
              {relocatingArtifact ? <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => persistArtifact(relocatingArtifact.type, { id: relocatingArtifact.id, color: artifactColor(relocatingArtifact), note: relocatingArtifact.note, existing: relocatingArtifact })} disabled={Boolean(busy)}><Highlighter aria-hidden="true" />绑定到此处</button> : <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => persistArtifact('highlight')} disabled={Boolean(busy)}><Highlighter aria-hidden="true" />保存重点</button>}
              {!relocatingArtifact && <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={openAnnotationEditor} disabled={Boolean(busy)}><PenLine aria-hidden="true" />{editingAnnotationId ? '编辑批注' : '写批注'}</button>}
              {!relocatingArtifact && <button type="button" onClick={() => { const value = `请解释这段内容：${selection.quote}`; setQuestion(value); setRightPanelTab('ai'); setOpenPanel('ai'); void submitQuestion(value) }} disabled={Boolean(busy)}><MessageSquareText aria-hidden="true" />问 AI</button>}
              <button type="button" onClick={() => setSelection(null)} aria-label="关闭文字工具"><X aria-hidden="true" /></button>
            </div>
          )}
          {document.kind === 'pdf' ? (
            readerMode === 'compatibility' ? (
              <div className="source-reader__compatibility">
                <header><strong>兼容模式</strong><span>使用浏览器原生 PDF 阅读器；本模式不支持应用内保存重点和文字追问。</span>{enhancedPdfSupported && <button type="button" onClick={() => setReaderMode('enhanced')}>返回增强阅读</button>}</header>
                <object data={`/api/documents/${encodeURIComponent(document.id)}/content`} type="application/pdf" aria-label={`${document.name} 原始 PDF`}>
                  <p>浏览器无法嵌入此 PDF。<a href={`/api/documents/${encodeURIComponent(document.id)}/content`} target="_blank" rel="noreferrer">请在新窗口打开原始 PDF</a></p>
                </object>
              </div>
            ) : pdf && pdfRuntime ? Array.from({ length: pdf.numPages }, (_, index) => {
              const page = index + 1
              const artifactCount = artifacts.filter((artifact) => artifact.anchor.kind === 'document' && artifact.anchor.page === page).length
              const pageArtifacts = artifacts.filter((artifact) => artifact.anchor.kind === 'document' && artifact.anchor.documentId === document.id && artifact.anchor.page === page)
              return <PdfPage key={page} active={Math.abs(page - currentPage) <= 2} pdf={pdf} runtime={pdfRuntime} pageNumber={page} zoom={zoom} artifacts={pageArtifacts} artifactCount={artifactCount} onVisible={handleVisiblePage} onUseCompatibility={() => setReaderMode('compatibility')} />
            }) : <div className="source-reader__loading" aria-live="polite"><BookOpen aria-hidden="true" /><strong>正在装订原稿</strong><span>稍等片刻，马上显示真实 PDF 页面。</span></div>
          ) : <div className="source-html-shell"><article className="source-html" ref={htmlRef} data-block-id="document-html" dangerouslySetInnerHTML={{ __html: html }} /><div className="source-artifact-layer" ref={htmlHighlightLayerRef} aria-hidden="true" /></div>}
          {error && errorCode !== 'api_key_invalid' && <p className="source-reader__error" role="alert">{error}</p>}
        </section>

        <aside id="source-ai" className={`source-ai ${openPanel === 'ai' ? 'is-open' : ''}`} aria-label="批注与原文追问">
          <button className="icon-button source-panel__close" type="button" onClick={() => setOpenPanel(null)} aria-label="关闭批注与原文追问"><X aria-hidden="true" /></button>
          <div className="source-ai__tabs" role="tablist" aria-label="原文工具">
            <button id="source-annotations-tab" type="button" role="tab" aria-selected={rightPanelTab === 'annotations'} aria-controls="source-annotations" onClick={() => setRightPanelTab('annotations')}>批注 <span>{annotationArtifacts.length}</span></button>
            <button id="source-ai-tab" type="button" role="tab" aria-selected={rightPanelTab === 'ai'} aria-controls="source-ai-panel" onClick={() => setRightPanelTab('ai')}>原文追问 <span>{answers.length}</span></button>
          </div>
          {rightPanelTab === 'annotations' ? <section id="source-annotations" className="source-ai__panel source-ai__annotations" role="tabpanel" aria-labelledby="source-annotations-tab">
            <header><span>批注</span><small>你的理解与疑问保存在本机</small></header>
            {annotationOpen && selection && <div className="source-ai__annotation-editor">
              <div className="source-ai__annotation-editor-head"><strong>{editingAnnotationId ? '编辑批注' : '新建批注'}</strong><button type="button" onClick={() => setAnnotationOpen(false)} aria-label="收起批注编辑"><X aria-hidden="true" /></button></div>
              <q>{selection.quote}</q>
              <div>{colorSwatches('annotation', annotationColor, (color) => { setAnnotationColor(color); setAnnotationDirty(true) }, '批注颜色')}<small className={`is-${annotationStatus}`}>{annotationStatusLabel()}</small></div>
              <textarea value={annotation} onChange={(event) => changeAnnotation(event.target.value)} placeholder="写下你的理解或疑问" autoFocus />
            </div>}
            <div className="source-ai__annotation-list">
              {annotationArtifacts.length === 0 && <p>选中文字后点击“写批注”，你的批注会保存在这里。</p>}
              {annotationArtifacts.map((artifact) => <article key={artifact.id} className={artifact.needsRelocation ? 'needs-relocation' : ''}>
                <button type="button" className="source-ai__annotation-open" onClick={() => artifact.anchor.kind === 'document' && artifact.anchor.page && jumpToPage(artifact.anchor.page)}><span>{artifact.needsRelocation ? '待重新定位' : '批注'}{artifact.anchor.kind === 'document' && artifact.anchor.page ? ` · 第 ${artifact.anchor.page} 页` : ''}</span><q>{artifact.anchor.quote}</q></button>
                {artifact.note && <p>{artifact.note}</p>}
                <div className="source-artifact-actions">{artifactActionMenu(artifact)}</div>
              </article>)}
            </div>
          </section> : <section id="source-ai-panel" className="source-ai__panel" role="tabpanel" aria-labelledby="source-ai-tab">
            <header><span>原文追问</span><small>只依据已导入证据</small></header>
            <div className="source-ai__history">
              {answers.length === 0 && <p>选中一段文字，或直接提出关于本章原文的问题。</p>}
              {answers.map((answer) => (
                <article key={answer.id}>
                  <h3>{answer.question}</h3>
                  <p>{answer.answer}</p>
                  {answer.citations.length > 0 && <details><summary>{answer.citations.length} 条原文证据</summary>{answer.citations.map((citation) => <blockquote key={citation.chunkId}><strong>{citation.title}{citation.page ? ` · 第 ${citation.page} 页` : ''}</strong>{citation.quote}</blockquote>)}</details>}
                  <small>置信度 {answer.confidence} · {answer.inputTokens + answer.outputTokens} tokens</small>
                </article>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void submitQuestion() }}>
              <label htmlFor="source-question">向原文提问</label>
              <textarea id="source-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：这段内容为什么重要？" />
              <button className="button button--primary" type="submit" disabled={busy === 'ask' || !question.trim()}>{busy === 'ask' ? '正在查证…' : '依据原文回答'}</button>
            </form>
          </section>}
          {error && <div className="source-ai__error" role="alert"><p>{error}</p>{errorCode === 'api_key_invalid' && onRequestKeyUpdate && <button className="button button--secondary" type="button" onClick={onRequestKeyUpdate}>更新 API Key</button>}</div>}
        </aside>
      </div>
      {lastDeletedArtifact && <div className="source-workspace__undo" role="status"><span>{lastDeletedArtifact.type === 'highlight' ? '重点' : '批注'}已删除</span><button type="button" onClick={() => void undoDeleteArtifact()} disabled={Boolean(busy)}><Undo2 aria-hidden="true" />撤销</button></div>}
      {renderArtifactMenu()}
    </div>
  )
}
