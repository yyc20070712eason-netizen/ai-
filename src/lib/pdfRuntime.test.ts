import { describe, expect, it } from 'vitest'
import { supportsEnhancedPdfRenderer } from './pdfRuntime'

describe('enhanced PDF browser support', () => {
  it('accepts Chrome 151 and rejects Edge 100', () => {
    expect(supportsEnhancedPdfRenderer('Mozilla/5.0 Chrome/151.0.7922.109 Safari/537.36')).toBe(true)
    expect(supportsEnhancedPdfRenderer('Mozilla/5.0 Chrome/100.0.4896.60 Safari/537.36 Edg/100.0.1185.36')).toBe(false)
  })
})
