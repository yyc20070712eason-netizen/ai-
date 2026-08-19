import { describe, expect, it } from 'vitest'
import { isConceptCheckPractice, isProjectStepPractice, isProjectSubmitPractice } from '../../../lib/practice'
import agentChapter from './index'

describe('Agent project activities', () => {
  it('uses two concept checks, eight project steps and five formal milestones', () => {
    expect(agentChapter.stages).toHaveLength(15)
    expect(agentChapter.stages.map((stage) => 'mode' in stage.practice ? stage.practice.mode : 'legacy')).toEqual([
      'concept-check', 'concept-check', 'project-submit',
      'project-step', 'project-step', 'project-submit',
      'project-step', 'project-step', 'project-submit',
      'project-step', 'project-step', 'project-submit',
      'project-step', 'project-step', 'project-submit',
    ])
    expect(agentChapter.stages.filter((stage) => isConceptCheckPractice(stage.practice))).toHaveLength(2)
    expect(agentChapter.stages.filter((stage) => isProjectStepPractice(stage.practice))).toHaveLength(8)
    expect(agentChapter.stages.filter((stage) => isProjectSubmitPractice(stage.practice)).map((stage) => stage.id)).toEqual([
      'model-boundaries', 'tools-and-react', 'multi-agent', 'intent-recognition', 'acceptance-iteration',
    ])
  })

  it('gives every activity a fixed situation, materials, action, format, constraints and success standard', () => {
    for (const stage of agentChapter.stages) {
      const practice = stage.practice
      expect('mode' in practice).toBe(true)
      if (!('mode' in practice)) continue
      expect(practice.context).toContain('订单查询与退款助手')
      expect(practice.given.length).toBeGreaterThan(0)
      expect(practice.deliverable.trim()).not.toBe('')
      expect(practice.constraints.length).toBeGreaterThan(0)
      expect(practice.success.trim()).not.toBe('')
      expect(practice.estimatedMinutes).toBeGreaterThanOrEqual(3)
    }
  })

  it('makes every project step write fields owned by its later milestone', () => {
    for (const stage of agentChapter.stages) {
      if (!isProjectStepPractice(stage.practice)) continue
      const milestoneStageId = stage.practice.milestoneStageId
      const target = agentChapter.stages.find((item) => item.id === milestoneStageId)
      expect(target).toBeDefined()
      expect(target?.unitId).toBe(stage.unitId)
      expect(agentChapter.stages.indexOf(target!)).toBeGreaterThan(agentChapter.stages.indexOf(stage))
      expect(target && isProjectSubmitPractice(target.practice)).toBe(true)
      if (!target || !isProjectSubmitPractice(target.practice)) continue
      const targetIds = target.practice.fields.map((field) => field.id)
      expect(stage.practice.fields.every((field) => targetIds.includes(field.id))).toBe(true)
    }
  })

  it('keeps rubric evidence, automatic checks and reference structures complete at every milestone', () => {
    for (const stage of agentChapter.stages) {
      if (!isProjectSubmitPractice(stage.practice)) continue
      expect(stage.practice.starterPackUrl).toBe('/practice/agent-blueprint-starter.zip')
      expect(stage.practice.rubric.length).toBeGreaterThanOrEqual(3)
      expect(stage.practice.rubric.every((item) => item.evidencePrompt.trim().length > 0)).toBe(true)
      expect(stage.practice.rubric.some((item) => item.critical)).toBe(true)
      expect(stage.practice.autoChecks.length).toBeGreaterThan(0)
      expect(stage.practice.reference.outline).toHaveLength(stage.practice.fields.length)
      expect(Object.keys(stage.practice.reference.exampleAnswers).sort()).toEqual(stage.practice.fields.map((field) => field.id).sort())
    }
  })
})
