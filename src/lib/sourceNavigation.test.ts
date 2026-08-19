import { describe, expect, it } from 'vitest'
import type { SourceReference, WorkspaceDocument } from '../types'
import { locateSourcePage, selectSourceDocument } from './sourceNavigation'

const reference = (label: string, sourceId = 'manual'): SourceReference => ({ sourceId, label })

describe('source navigation', () => {
  it('locates the first section in a numeric range without fixed page metadata', () => {
    expect(locateSourcePage([
      { page: 1, text: '封面与导读' },
      { page: 6, text: 'Agent 的四大组成部分详解 3.1 组成部分总览' },
      { page: 7, text: '3.2 组成部分一：大语言模型' },
      { page: 19, text: '代码行号 30 31 32 33 34 与工具使用说明' },
    ], [reference('原文 3.1–3.2')], '模型是大脑，不是整个身体')).toBe(6)
  })

  it('uses descriptive headings for future chapters without section numbers', () => {
    expect(locateSourcePage([
      { page: 2, text: '课程目录：基础、工具与验证' },
      { page: 12, text: 'Prompt / Context / Harness Engineering\n三层问题的故障位置不同。' },
    ], [reference('Prompt / Context / Harness Engineering')])).toBe(12)
  })

  it('prefers the latest document bound to the referenced source', () => {
    const documents = [
      { id: 'other', sourceId: 'other', isLatest: true },
      { id: 'old', sourceId: 'manual', isLatest: false },
      { id: 'latest', sourceId: 'manual', isLatest: true },
    ] as WorkspaceDocument[]
    expect(selectSourceDocument(documents, [reference('3.1')])?.id).toBe('latest')
  })

  it('falls back to the latest chapter document for legacy source ids', () => {
    const documents = [
      { id: 'legacy', sourceId: 'legacy-agent', isLatest: true },
    ] as WorkspaceDocument[]
    expect(selectSourceDocument(documents, [reference('3.1', 'agent-manual')])?.id).toBe('legacy')
  })
})
