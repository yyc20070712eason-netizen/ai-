import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rubricEvidenceKey, isProjectSubmitPractice } from '../lib/practice'
import agentChapter from '../content/chapters/agent'
import type { PracticeSubmission } from '../types'
import { PracticeWorkbench } from './PracticeWorkbench'

const candidate = agentChapter.stages.find((stage) => stage.id === 'model-boundaries')!.practice
if (!isProjectSubmitPractice(candidate)) throw new Error('project submit practice expected')
const practice = candidate

function submission(overrides: Partial<PracticeSubmission> = {}): PracticeSubmission {
  const answers = {
    'system-map': '目标、四层职责、六步数据流、失败点与完成证据。',
    'action-contract': JSON.stringify({ tool: 'order_lookup', input: { orderId: 'A100' }, reason: '读取实时状态', fallback: 'ask_user' }),
    ...Object.fromEntries(practice.rubric.map((item) => [rubricEvidenceKey(item.id), `01-system-map.md 中的 ${item.id} 段落。`])),
  }
  return {
    answers,
    checkedRubricIds: practice.rubric.map((item) => item.id),
    draftUpdatedAt: '2026-08-18T00:00:00.000Z',
    revisionCount: 0,
    ...overrides,
  }
}

const baseProps = {
  practice,
  hasApiKey: false,
  busy: false,
  onDraft: vi.fn(),
  onToggleRubric: vi.fn(),
  onSubmit: vi.fn(),
  onFeedback: vi.fn(),
  onOpenSettings: vi.fn(),
}

describe('PracticeWorkbench', () => {
  afterEach(cleanup)

  it('keeps reference hidden before submission and requires evidence for every rubric', () => {
    const incomplete = submission()
    delete incomplete.answers[rubricEvidenceKey(practice.rubric[0].id)]
    render(<PracticeWorkbench {...baseProps} submission={incomplete} />)
    expect(screen.queryByText('参考结构与常见遗漏')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '提交阶段成果' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: '自动检查' })).toBeInTheDocument()
  })

  it('allows concise non-blank evidence and reports deterministic JSON success', () => {
    render(<PracticeWorkbench {...baseProps} submission={submission()} />)
    expect(screen.getByRole('button', { name: '提交阶段成果' })).toBeEnabled()
    expect(screen.getByText('JSON 结构和必填字段有效。')).toBeInTheDocument()
  })

  it('submits failed automatic checks as a revision instead of meeting standard', () => {
    const invalid = submission({ submittedAt: '2026-08-18T00:05:00.000Z', answers: { ...submission().answers, 'action-contract': '{ invalid' } })
    render(<PracticeWorkbench {...baseProps} submission={invalid} />)
    expect(screen.getByText('建议修改')).toBeInTheDocument()
    expect(screen.getByText('JSON 无法解析，请先在本机修正格式。')).toBeInTheDocument()
    expect(screen.getByText('参考结构与常见遗漏')).toBeInTheDocument()
  })

  it('shows meeting-standard state and keeps AI feedback optional after submission', () => {
    render(<PracticeWorkbench {...baseProps} hasApiKey submission={submission({ submittedAt: '2026-08-18T00:05:00.000Z' })} />)
    expect(screen.getByText('按标准达标')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '让 AI 点评' })).toBeInTheDocument()
  })

  it('saves learner edits without reading local files', () => {
    const onDraft = vi.fn()
    render(<PracticeWorkbench {...baseProps} onDraft={onDraft} />)
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '我在本机完成的系统图摘要。' } })
    expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ 'system-map': '我在本机完成的系统图摘要。' }))
  })
})
