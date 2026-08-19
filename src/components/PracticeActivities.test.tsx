import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import agentChapter from '../content/chapters/agent'
import { isConceptCheckPractice, isProjectStepPractice } from '../lib/practice'
import { ConceptCheck } from './ConceptCheck'
import { ProjectStep } from './ProjectStep'

describe('lightweight Agent activities', () => {
  afterEach(cleanup)

  it('gives immediate concept feedback without a submission callback', () => {
    const practice = agentChapter.stages[0].practice
    if (!isConceptCheckPractice(practice)) throw new Error('concept check expected')
    render(<ConceptCheck practice={practice} />)
    fireEvent.click(screen.getByRole('radio', { name: /产品 C/ }))
    fireEvent.click(screen.getByRole('button', { name: '检查判断' }))
    expect(screen.getByRole('status')).toHaveTextContent('判断正确')
  })

  it('restores and updates a project draft owned by the later milestone', () => {
    const practice = agentChapter.stages.find((stage) => stage.id === 'planning')!.practice
    if (!isProjectStepPractice(practice)) throw new Error('project step expected')
    const onDraft = vi.fn()
    render(<ProjectStep practice={practice} submission={{ answers: { 'execution-plan': '已有草稿' }, checkedRubricIds: [], draftUpdatedAt: '2026-08-18T00:00:00.000Z', revisionCount: 0 }} onDraft={onDraft} />)
    expect(screen.getByDisplayValue('已有草稿')).toBeInTheDocument()
    expect(screen.getByText(/里程碑 2：让 Agent 可执行/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '更新后的五步计划' } })
    expect(onDraft).toHaveBeenCalledWith({ 'execution-plan': '更新后的五步计划' })
  })
})
