import { describe, expect, it } from 'vitest'
import { canonicalAnchorText, findTextRange, findUniqueTextAnchor } from './textAnchors'

describe('persistent text anchors', () => {
  it('matches text across PDF spans while ignoring artificial whitespace', () => {
    const root = document.createElement('div')
    root.innerHTML = '<span>大 模 型</span><span> Agent 知识</span>'
    const range = findTextRange(root, '大模型 Agent 知识')
    expect(canonicalAnchorText(range?.toString() ?? '')).toBe(canonicalAnchorText('大模型 Agent 知识'))
  })

  it('uses the stored offset to choose between duplicate quotes', () => {
    const root = document.createElement('div')
    root.textContent = '第一处关键结论。中间内容。第二处关键结论。'
    expect(findTextRange(root, '关键结论', 18)?.toString()).toBe('关键结论')
  })

  it('recovers a unique PDF quote when the saved selection contains line breaks', () => {
    const source = '1.自主感知:能够理解当前环境和任务需求2.自主决策:能够制定执行计划并动态调整'
    const quote = '1.自主感知:能够理解当前环境和任务需求\n2.自主决策:能够制定执行计划并动态调整'
    expect(findUniqueTextAnchor(source, quote)).toEqual({ start: 0, end: source.length })
  })

  it('normalizes full-width characters, artificial spaces, and PDF controls without changing offsets', () => {
    const source = 'ＡＩ\u0001 Agent 负责\n判断'
    const match = findUniqueTextAnchor(source, 'AI Agent负责判断')
    expect(match).toEqual({ start: 0, end: source.length })
  })

  it('does not guess when normalized text is duplicated or missing', () => {
    expect(findUniqueTextAnchor('同一句。同一句。', '同一句')).toBeNull()
    expect(findUniqueTextAnchor('完全不同的内容', '不存在')).toBeNull()
  })
})
