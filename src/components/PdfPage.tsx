import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPdfDiagnostic, errorCode, isCancellation, reportPdfDiagnostic } from '../lib/pdfDiagnostics'
import { sharedPdfRenderQueue } from '../lib/pdfRenderQueue'
import type { PdfDocument, PdfRenderTask, PdfRuntime, PdfTextLayerTask } from '../lib/pdfRuntime'
import type { LearningArtifact } from '../types'
import { renderArtifactHighlights } from '../lib/artifactHighlights'

type PdfPageStatus = 'idle' | 'queued' | 'rendering' | 'ready' | 'text-layer-limited' | 'retrying' | 'failed'

type PdfPageProps = {
  active: boolean
  artifacts?: LearningArtifact[]
  artifactCount?: number
  onUseCompatibility: () => void
  onVisible: (page: number) => void
  pageNumber: number
  pdf: PdfDocument
  runtime: PdfRuntime
  zoom: number
}

type PdfPageStyle = CSSProperties & {
  '--pdf-page-max': string
  '--pdf-page-fluid': string
  '--pdf-page-ratio': string
}

const MAX_CANVAS_PIXELS = 4_000_000

function waitForRetry(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, 250)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeout)
      reject(Object.assign(new Error('PDF render cancelled'), { name: 'AbortError' }))
    }, { once: true })
  })
}

function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
  return Promise.resolve()
}

export function PdfPage({ active, pdf, runtime, pageNumber, zoom, artifacts = [], artifactCount = 0, onVisible, onUseCompatibility }: PdfPageProps) {
  const shellRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const highlightLayerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(595 / 842)
  const [renderWidth, setRenderWidth] = useState(0)
  const [status, setStatus] = useState<PdfPageStatus>('idle')
  const [retryKey, setRetryKey] = useState(0)
  const [diagnostic, setDiagnostic] = useState<ReturnType<typeof createPdfDiagnostic> | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const node = shellRef.current
    if (!node) return
    let timeout = 0
    let lastWidth = 0
    const applyWidth = () => {
      const nextWidth = Math.max(1, Math.round(node.clientWidth))
      if (!lastWidth || Math.abs(nextWidth - lastWidth) >= 2) {
        lastWidth = nextWidth
        setRenderWidth(nextWidth)
      }
    }
    const scheduleWidth = () => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(applyWidth, 150)
    }
    applyWidth()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleWidth)
      return () => {
        window.clearTimeout(timeout)
        window.removeEventListener('resize', scheduleWidth)
      }
    }
    const observer = new ResizeObserver(scheduleWidth)
    observer.observe(node)
    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const node = shellRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onVisible(pageNumber)
    }, { rootMargin: '-20% 0px -55% 0px', threshold: 0 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onVisible, pageNumber])

  useEffect(() => {
    const canvas = canvasRef.current
    const textContainer = textLayerRef.current
    if (!active || !renderWidth || !canvas || !textContainer) {
      if (!active && canvas) {
        canvas.width = 1
        canvas.height = 1
        textContainer?.replaceChildren()
        setStatus('idle')
      }
      return
    }

    let mounted = true
    let renderTask: PdfRenderTask | undefined
    let textTask: PdfTextLayerTask | undefined
    setDiagnostic(null)
    setCopied(false)
    setStatus('queued')

    const queued = sharedPdfRenderQueue.schedule(async (signal) => {
      const abortRender = () => {
        renderTask?.cancel()
        textTask?.cancel()
      }
      signal.addEventListener('abort', abortRender, { once: true })
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            if (mounted) setStatus(attempt ? 'retrying' : 'rendering')
            const page = await pdf.getPage(pageNumber)
            if (signal.aborted) throw Object.assign(new Error('PDF render cancelled'), { name: 'AbortError' })

            const baseViewport = page.getViewport({ scale: 1 })
            const cssScale = renderWidth / baseViewport.width
            const cssViewport = page.getViewport({ scale: cssScale })
            const pagePixels = Math.max(1, cssViewport.width * cssViewport.height)
            const pixelBudgetScale = Math.sqrt(MAX_CANVAS_PIXELS / pagePixels)
            const outputScale = attempt === 0
              ? Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5, pixelBudgetScale))
              : 1
            const renderViewport = page.getViewport({ scale: cssScale * outputScale })
            const stagingCanvas = document.createElement('canvas')
            stagingCanvas.width = Math.max(1, Math.floor(renderViewport.width))
            stagingCanvas.height = Math.max(1, Math.floor(renderViewport.height))
            if (!stagingCanvas.getContext('2d', { alpha: false })) throw new Error('PDF canvas unavailable')

            renderTask = page.render({ canvas: stagingCanvas, viewport: renderViewport, background: 'rgb(255,255,255)' })
            await renderTask.promise
            if (signal.aborted) throw Object.assign(new Error('PDF render cancelled'), { name: 'AbortError' })

            const visibleCanvas = canvasRef.current
            const visibleText = textLayerRef.current
            const shell = shellRef.current
            if (!mounted || !visibleCanvas || !visibleText || !shell) return
            const visibleContext = visibleCanvas.getContext('2d', { alpha: false })
            if (!visibleContext) throw new Error('Visible PDF canvas unavailable')
            visibleCanvas.width = stagingCanvas.width
            visibleCanvas.height = stagingCanvas.height
            visibleContext.drawImage(stagingCanvas, 0, 0)
            shell.style.setProperty('--scale-factor', String(cssScale))
            shell.style.setProperty('--total-scale-factor', String(cssScale))
            setRatio(baseViewport.width / baseViewport.height)

            visibleText.replaceChildren()
            try {
              textTask = runtime.createTextLayer({
                textContentSource: await page.getTextContent(),
                container: visibleText,
                viewport: cssViewport,
              })
              await textTask.render()
              if (mounted) setStatus('ready')
            } catch (reason) {
              if (isCancellation(reason)) throw reason
              const textDiagnostic = createPdfDiagnostic({
                attempt: attempt + 1,
                code: errorCode(reason),
                devicePixelRatio: window.devicePixelRatio || 1,
                pageNumber,
                phase: 'text-layer',
                viewportWidth: renderWidth,
              })
              reportPdfDiagnostic(textDiagnostic)
              if (mounted) {
                setDiagnostic(textDiagnostic)
                setStatus('text-layer-limited')
              }
            }
            return
          } catch (reason) {
            if (isCancellation(reason)) throw reason
            const pageDiagnostic = createPdfDiagnostic({
              attempt: attempt + 1,
              code: errorCode(reason),
              devicePixelRatio: window.devicePixelRatio || 1,
              pageNumber,
              phase: 'canvas',
              viewportWidth: renderWidth,
            })
            reportPdfDiagnostic(pageDiagnostic)
            if (mounted) setDiagnostic(pageDiagnostic)
            if (attempt === 0) {
              if (mounted) setStatus('retrying')
              await waitForRetry(signal)
              continue
            }
            throw reason
          }
        }
      } finally {
        signal.removeEventListener('abort', abortRender)
      }
    })

    void queued.promise.catch((reason: unknown) => {
      if (mounted && !isCancellation(reason)) setStatus('failed')
    })
    return () => {
      mounted = false
      queued.cancel()
      renderTask?.cancel()
      textTask?.cancel()
    }
  }, [active, pageNumber, pdf, renderWidth, retryKey, runtime, zoom])

  useEffect(() => {
    if (status !== 'ready') {
      highlightLayerRef.current?.replaceChildren()
      return
    }
    renderArtifactHighlights(textLayerRef.current, highlightLayerRef.current, artifacts)
  }, [artifacts, renderWidth, status, zoom])

  const style: PdfPageStyle = {
    '--pdf-page-max': `${48 * zoom}rem`,
    '--pdf-page-fluid': `${zoom * 100}%`,
    '--pdf-page-ratio': String(ratio),
  }

  const diagnosticText = diagnostic ? JSON.stringify(diagnostic, null, 2) : ''

  return (
    <article
      className={`pdf-page is-${status}`}
      id={`source-page-${pageNumber}`}
      ref={shellRef}
      style={style}
      data-block-id={`page-${pageNumber}`}
      data-page={pageNumber}
      aria-label={`原文第 ${pageNumber} 页`}
    >
      <div className="pdf-page__paper">
        <canvas ref={canvasRef} aria-hidden="true" />
        <div className="source-artifact-layer" ref={highlightLayerRef} aria-hidden="true" />
        <div className="textLayer" ref={textLayerRef} />
        {status !== 'ready' && status !== 'text-layer-limited' && (
          <div className="pdf-page__status" aria-live="polite">
            {status === 'failed' ? (
              <>
                <strong>第 {pageNumber} 页暂时无法显示</strong>
                <span>{diagnostic ? `错误编号：${diagnostic.code}` : '请尝试重新加载。'}</span>
                <div className="pdf-page__actions">
                  <button type="button" onClick={() => setRetryKey((value) => value + 1)}>重新加载本页</button>
                  <button type="button" onClick={onUseCompatibility}>使用兼容模式</button>
                  {diagnostic && <button type="button" onClick={() => { void copyText(diagnosticText).then(() => setCopied(true)) }}>{copied ? '已复制诊断信息' : '复制诊断信息'}</button>}
                </div>
              </>
            ) : `正在载入第 ${pageNumber} 页`}
          </div>
        )}
        {status === 'text-layer-limited' && <div className="pdf-page__text-limited">本页已显示；文字选择暂不可用。</div>}
      </div>
      <footer><span>{pageNumber}</span>{artifactCount > 0 && <span>{artifactCount} 条标记</span>}</footer>
    </article>
  )
}
