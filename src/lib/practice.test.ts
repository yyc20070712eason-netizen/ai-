import { describe, expect, it } from 'vitest'
import agentChapter from '../content/chapters/agent'
import type { PracticeFeedback, PracticeSubmission, ProjectSubmitPractice } from '../types'
import { evaluateProjectPractice, isProjectSubmitPractice, practiceAllowsMastery, practiceTargetRef, rubricEvidenceKey } from './practice'

function formal(stageId: string): ProjectSubmitPractice {
  const practice = agentChapter.stages.find((stage) => stage.id === stageId)!.practice
  if (!isProjectSubmitPractice(practice)) throw new Error('formal practice expected')
  return practice
}

function evidence(practice: ProjectSubmitPractice) {
  return Object.fromEntries(practice.rubric.map((item) => [rubricEvidenceKey(item.id), `证据位于 ${item.id} 字段。`]))
}

describe('project practice evaluation', () => {
  it('routes project-step drafts to the final stage key', () => {
    const step = agentChapter.stages.find((stage) => stage.id === 'planning')!.practice
    expect(practiceTargetRef({ chapterId: 'agent', stageId: 'planning' }, step)).toEqual({ chapterId: 'agent', stageId: 'tools-and-react' })
  })

  it('distinguishes ready, meets and needs-revision', () => {
    const practice = formal('model-boundaries')
    const base: PracticeSubmission = {
      answers: {
        'system-map': '完整系统图',
        'action-contract': JSON.stringify({ tool: 'order_lookup', input: { orderId: 'A100' }, reason: '实时查询', fallback: 'ask_user' }),
        ...evidence(practice),
      },
      checkedRubricIds: practice.rubric.map((item) => item.id), draftUpdatedAt: '2026-08-18T00:00:00.000Z', revisionCount: 0,
    }
    expect(evaluateProjectPractice(practice, base).state).toBe('ready')
    expect(evaluateProjectPractice(practice, { ...base, submittedAt: '2026-08-18T00:01:00.000Z' }).state).toBe('meets')
    expect(evaluateProjectPractice(practice, { ...base, answers: { ...base.answers, 'action-contract': '{}' }, submittedAt: '2026-08-18T00:01:00.000Z' }).state).toBe('needs-revision')
  })

  it('requires all evaluation categories and a passing Node test summary', () => {
    const evaluationPractice = formal('intent-recognition')
    const cases = ['normal', 'missing-input', 'stale-data', 'tool-failure', 'unauthorized'].flatMap((category, group) => [0, 1].map((item) => ({ id: `case-${group}-${item}`, category, input: '虚拟输入', expectedAction: 'clarify', expectedEvidence: '未调用写工具' })))
    const evaluationSubmission: PracticeSubmission = {
      answers: { 'implementation-choice': '最小实现选择', 'eval-cases': JSON.stringify(cases), ...evidence(evaluationPractice) },
      checkedRubricIds: evaluationPractice.rubric.map((item) => item.id), draftUpdatedAt: '2026-08-18T00:00:00.000Z', revisionCount: 0, submittedAt: '2026-08-18T00:01:00.000Z',
    }
    expect(evaluateProjectPractice(evaluationPractice, evaluationSubmission).state).toBe('meets')

    const finalPractice = formal('acceptance-iteration')
    const finalSubmission: PracticeSubmission = {
      answers: {
        'assistant-spec': '完整规格',
        'intent-schema': JSON.stringify({ intents: { orderLookup: {}, addressChange: {} }, confirmationRules: { addressChange: { required: true } }, fallback: { action: 'clarify' } }),
        'iteration-report': '最小修复与回归证据', 'test-output': '# pass 5\n# fail 1', ...evidence(finalPractice),
      },
      checkedRubricIds: finalPractice.rubric.map((item) => item.id), draftUpdatedAt: '2026-08-18T00:00:00.000Z', revisionCount: 0, submittedAt: '2026-08-18T00:01:00.000Z',
    }
    expect(evaluateProjectPractice(finalPractice, finalSubmission).state).toBe('needs-revision')
    finalSubmission.answers['test-output'] = '# pass 5\n# fail 0'
    expect(evaluateProjectPractice(finalPractice, finalSubmission).state).toBe('meets')
  })

  it('does not let optional AI feedback override mastery', () => {
    const practice = formal('model-boundaries')
    const feedback: PracticeFeedback = { strengths: ['结构清楚'], gaps: [], rubric: [], nextStep: '继续', inputTokens: 10, outputTokens: 10, createdAt: '2026-08-18T00:00:00.000Z' }
    const incomplete: PracticeSubmission = { answers: {}, checkedRubricIds: [], draftUpdatedAt: '2026-08-18T00:00:00.000Z', revisionCount: 0, submittedAt: '2026-08-18T00:01:00.000Z', feedback }
    expect(practiceAllowsMastery(practice, incomplete)).toBe(false)
    expect(practiceAllowsMastery(agentChapter.stages[0].practice)).toBe(true)
  })
})
