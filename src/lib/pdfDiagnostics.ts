export type PdfRenderPhase = 'load-page' | 'canvas' | 'text-layer'

export type PdfRenderError = {
  attempt: number
  browserVersion: string
  code: string
  devicePixelRatio: number
  occurredAt: string
  pageNumber: number
  phase: PdfRenderPhase
  viewportWidth: number
}

function browserVersion() {
  const match = navigator.userAgent.match(/(?:Edg|Chrome)\/([\d.]+)/)
  return match ? match[0] : 'unknown-browser'
}

export function createPdfDiagnostic(input: Omit<PdfRenderError, 'browserVersion' | 'occurredAt'>): PdfRenderError {
  return { ...input, browserVersion: browserVersion(), occurredAt: new Date().toISOString() }
}

export function errorCode(reason: unknown) {
  if (reason instanceof Error) {
    if (reason.name === 'RenderingCancelledException' || reason.name === 'AbortError') return 'render-cancelled'
    if (/version.+match/i.test(reason.message)) return 'worker-version-mismatch'
    if (/canvas/i.test(reason.message)) return 'canvas-render-failed'
    if (/worker/i.test(reason.message)) return 'worker-load-failed'
  }
  return 'pdf-render-failed'
}

export function isCancellation(reason: unknown) {
  return reason instanceof Error && (reason.name === 'RenderingCancelledException' || reason.name === 'AbortError')
}

export function reportPdfDiagnostic(diagnostic: PdfRenderError) {
  console.warn('[AI Study Plan PDF]', diagnostic)
  void fetch('/api/diagnostics/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diagnostic),
  }).catch(() => undefined)
}
