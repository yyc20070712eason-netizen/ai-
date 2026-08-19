import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist/types/src/display/api'
import type { TextLayerParameters } from 'pdfjs-dist/types/src/display/text_layer'

export type PdfTextLayerTask = {
  cancel: () => void
  render: () => Promise<void>
}

export type PdfRuntime = {
  createTextLayer: (params: TextLayerParameters) => PdfTextLayerTask
  getDocument: (params: { data: Uint8Array, isOffscreenCanvasSupported: boolean, useSystemFonts: boolean }) => PDFDocumentLoadingTask
}

export type PdfDocument = PDFDocumentProxy
export type PdfRenderTask = RenderTask

let runtimePromise: Promise<PdfRuntime> | undefined

export function supportsEnhancedPdfRenderer(userAgent = navigator.userAgent) {
  const chromium = userAgent.match(/(?:Edg|Chrome)\/(\d+)/)
  return Boolean(chromium && Number(chromium[1]) >= 125)
}

export function loadPdfRuntime(buildId: string) {
  if (runtimePromise) return runtimePromise
  runtimePromise = Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = `${worker.default}?build=${encodeURIComponent(buildId)}`
    return {
      getDocument: pdfjs.getDocument,
      createTextLayer: (params) => new pdfjs.TextLayer(params),
    }
  })
  return runtimePromise
}
