import { describe, expect, it } from 'vitest'
import { normalizeExtractedPdfText } from './pdfText'

describe('PDF text normalization', () => {
  it('removes PDF control glyphs and artificial spacing between Chinese characters', () => {
    expect(normalizeExtractedPdfText('大 模 型\u0001 AI Agent 知 识\n\n\n从 0 - 1')).toBe('大模型 AI Agent 知识\n\n从 0 - 1')
  })

  it('keeps meaningful spaces in Latin text and code', () => {
    expect(normalizeExtractedPdfText('Agent planning and tool execution\nconst value = 1')).toBe('Agent planning and tool execution\nconst value = 1')
  })
})
