import { describe, expect, it } from 'vitest'
import type { FocusSession } from '../types'
import { allocateSectionMinutes, focusMinutesByWeekday } from './uiMetrics'

describe('UI metrics', () => {
  it('allocates every stage minute exactly once while preserving relative reading weight', () => {
    expect(allocateSectionMinutes(12, [12, 8, 4])).toEqual([6, 4, 2])
    expect(allocateSectionMinutes(2, [10, 1, 1]).reduce((total, minutes) => total + minutes, 0)).toBe(2)
    expect(allocateSectionMinutes(0, [1, 1])).toEqual([0, 0])
  })

  it('counts only completed local sessions from Monday through the current moment', () => {
    const now = new Date(2026, 7, 19, 12, 0, 0)
    const sessions: FocusSession[] = [
      { stage: { chapterId: 'agent', stageId: 'role' }, completedAt: new Date(2026, 7, 17, 9, 0).toISOString(), minutes: 25 },
      { stage: { chapterId: 'agent', stageId: 'role' }, completedAt: new Date(2026, 7, 18, 9, 0).toISOString(), minutes: 15 },
      { stage: { chapterId: 'agent', stageId: 'role' }, completedAt: new Date(2026, 7, 19, 11, 0).toISOString(), minutes: 10 },
      { stage: { chapterId: 'agent', stageId: 'role' }, completedAt: new Date(2026, 7, 19, 13, 0).toISOString(), minutes: 40 },
      { stage: { chapterId: 'agent', stageId: 'role' }, completedAt: new Date(2026, 7, 16, 23, 59).toISOString(), minutes: 30 },
    ]
    expect(focusMinutesByWeekday(sessions, now)).toEqual([25, 15, 10, 0, 0, 0, 0])
  })
})
