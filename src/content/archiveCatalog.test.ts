import { describe, expect, it } from 'vitest'
import { ARCHIVE_CATALOG, matchArchiveFile, validateArchiveCatalog } from './archiveCatalog'

describe('fixed personal archive catalog', () => {
  it('contains the seven personal-course IDs exactly once and no password material', () => {
    expect(ARCHIVE_CATALOG.map((item) => item.id)).toEqual([
      'agent',
      'ai-harness',
      'transformer',
      'rag',
      'langchain',
      'langgraph',
      'vibe-coding',
    ])
    expect(validateArchiveCatalog()).toBe(true)
    expect(ARCHIVE_CATALOG.every((item) => item.url.startsWith('https://gcnum0i2ctpz.feishu.cn/docx/'))).toBe(true)
    expect(ARCHIVE_CATALOG.every((item) => item.courseReady && item.chapterId === item.id)).toBe(true)
    expect(JSON.stringify(ARCHIVE_CATALOG)).not.toMatch(/password|密码|passcode|secret/i)
    expect(Object.keys(ARCHIVE_CATALOG[0]).sort()).toEqual(['aliases', 'chapterId', 'courseReady', 'id', 'order', 'title', 'url'])
  })

  it('matches recognizable PDF names but refuses ambiguous names', () => {
    expect(matchArchiveFile('RAG手册.pdf')?.id).toBe('rag')
    expect(matchArchiveFile('LangGraph框架从入门到实战.pdf')?.id).toBe('langgraph')
    expect(matchArchiveFile('LangGraph+MCP智能出行助手项目.pdf')).toBeNull()
    expect(matchArchiveFile('AI学习资料.pdf')).toBeNull()
  })
})
