import { describe, expect, it } from 'vitest'
import { LEGACY_AGENT_STAGE_MAP } from '../content/chapters/agent'
import { flattenCatalog, flattenChapter, getChapter } from '../content/registry'
import type { QuizQuestion, StudyStateV1, StudyStateV3 } from '../types'
import {
  createReviewQueue,
  dueReviews,
  focusMinutesThisWeek,
  formatFocusDuration,
  gradeQuiz,
  LEGACY_STORAGE_KEY,
  loadStudyState,
  mergeImportedState,
  migrateStudyStateV1,
  migrateStudyStateV2,
  migrateStudyStateV3,
  migrateStudyStateV4,
  rescheduleReview,
  sampleQuiz,
  startOfLocalWeek,
  STORAGE_KEY,
  V2_STORAGE_KEY,
  V3_STORAGE_KEY,
} from './study'

const makeQuestion = (id: string, scenario: boolean, critical = false): QuizQuestion => ({
  id,
  prompt: `问题 ${id}`,
  choices: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  answer: 'a',
  explanation: '解析',
  scenario,
  critical,
})

const quizBank = [
  makeQuestion('s1', true, true),
  makeQuestion('s2', true),
  makeQuestion('s3', true),
  makeQuestion('s4', true),
  makeQuestion('s5', true),
  makeQuestion('k1', false),
  makeQuestion('k2', false),
  makeQuestion('k3', false),
]

const legacyState: StudyStateV1 = {
  version: 1,
  currentStageId: 4,
  completedStageIds: [1, 4],
  quizResults: {
    1: { score: 100, passed: true, answeredAt: '2026-01-01T00:00:00.000Z', wrongQuestionIds: [], attempt: 0 },
    4: { score: 80, passed: true, answeredAt: '2026-01-02T00:00:00.000Z', wrongQuestionIds: ['4-2'], attempt: 1 },
  },
  notes: { 4: '先拆计划，再调用工具。' },
  reviewQueue: [{ stageId: 4, dueAt: '2026-01-03T00:00:00.000Z', intervalIndex: 0 }],
  timerMinutes: 20,
  focusSessions: [{ stageId: 1, completedAt: '2026-01-01T01:00:00.000Z', minutes: 20 }],
}

describe('sampleQuiz', () => {
  it('is deterministic and always returns 3 scenarios, 2 knowledge questions, and a critical question', () => {
    const first = sampleQuiz(quizBank, 'agent:planning', 2)
    const again = sampleQuiz(quizBank, 'agent:planning', 2)
    expect(first.map((question) => question.id)).toEqual(again.map((question) => question.id))
    expect(first).toHaveLength(5)
    expect(first.filter((question) => question.scenario)).toHaveLength(3)
    expect(first.filter((question) => !question.scenario)).toHaveLength(2)
    expect(first.some((question) => question.critical)).toBe(true)
  })

  it('rejects a bank that cannot satisfy the sampling contract', () => {
    expect(() => sampleQuiz(quizBank.filter((question) => !question.critical), 'agent:planning', 0)).toThrow()
  })

  it('requires both 80 points and the critical answer to pass', () => {
    const questions = sampleQuiz(quizBank, 'agent:planning', 0)
    const answers = Object.fromEntries(questions.map((question) => [question.id, question.answer]))
    const critical = questions.find((question) => question.critical)!
    answers[critical.id] = 'b'
    const result = gradeQuiz(questions, answers, 0, new Date('2026-01-01T00:00:00.000Z'))
    expect(result.score).toBe(80)
    expect(result.passed).toBe(false)
    expect(result.wrongQuestionIds).toEqual([critical.id])
  })

  it('satisfies the five-question contract for every registered stage and attempt', () => {
    for (const { chapter, stage } of flattenCatalog()) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const picked = sampleQuiz(stage.quiz, `${chapter.id}:${stage.id}`, attempt)
        expect(picked).toHaveLength(5)
        expect(new Set(picked.map((question) => question.id)).size).toBe(5)
        expect(picked.filter((question) => question.scenario)).toHaveLength(3)
        expect(picked.filter((question) => !question.scenario)).toHaveLength(2)
        expect(picked.some((question) => question.critical)).toBe(true)
      }
    }
  })
})

describe('v1 migration and persistence', () => {
  it('maps every legacy location to the Agent chapter without losing progress', () => {
    const migrated = migrateStudyStateV1(legacyState)
    expect(migrated.current).toEqual({ chapterId: 'agent', stageId: 'planning' })
    expect(migrated.lastStageByChapter.agent).toBe('planning')
    expect(migrated.stageProgress['agent:what-is-agent'].completedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(migrated.stageProgress['agent:planning'].note).toBe('先拆计划，再调用工具。')
    expect(migrated.reviewQueue[0].stage).toEqual({ chapterId: 'agent', stageId: 'planning' })
    expect(migrated.focusSessions[0].stage).toEqual({ chapterId: 'agent', stageId: 'what-is-agent' })
  })

  it('prefers valid v2 and migrates v1 only when v2 is absent, preserving the v1 key', () => {
    const values = new Map<string, string>([[LEGACY_STORAGE_KEY, JSON.stringify(legacyState)]])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const migrated = loadStudyState(storage)
    expect(migrated.version).toBe(5)
    expect(values.has(STORAGE_KEY)).toBe(true)
    expect(values.get(LEGACY_STORAGE_KEY)).toBe(JSON.stringify(legacyState))

    const preferred = { ...migrated, timerMinutes: 25 }
    values.set(STORAGE_KEY, JSON.stringify(preferred))
    expect(loadStudyState(storage).timerMinutes).toBe(25)
  })

  it('migrates a complete v2 snapshot through v3 to v4, shows the map once, and preserves its last stage', () => {
    const v2 = migrateStudyStateV1(legacyState)
    const values = new Map<string, string>([[V2_STORAGE_KEY, JSON.stringify(v2)]])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const migrated = loadStudyState(storage)
    expect(migrated.version).toBe(5)
    expect(migrated.favoriteQuestions).toEqual([])
    expect(migrated.location).toEqual({ kind: 'chapter-map', chapterId: 'agent' })
    expect(migrated.lastStageByChapter.agent).toBe('planning')
    expect(migrated.stageProgress['agent:planning'].note).toBe('先拆计划，再调用工具。')
    expect(migrated.reviewQueue).toEqual(v2.reviewQueue)
    expect(migrated.focusSessions).toEqual(v2.focusSessions)
    expect(values.get(V2_STORAGE_KEY)).toBe(JSON.stringify(v2))
    expect(values.has(STORAGE_KEY)).toBe(true)
  })

  it('recovers from corrupt v2 by using the preserved v1 value', () => {
    const values = new Map<string, string>([
      [STORAGE_KEY, '{broken'],
      [LEGACY_STORAGE_KEY, JSON.stringify(legacyState)],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(loadStudyState(storage).location).toEqual({ kind: 'chapter-map', chapterId: 'agent' })
  })

  it('rejects malformed nested imports and accepts legacy imports', () => {
    const valid = migrateStudyStateV1(legacyState)
    const malformed = {
      ...valid,
      stageProgress: { 'agent:planning': { quizResult: { score: 999 } } },
    }
    expect(mergeImportedState(malformed)).toBeNull()
    expect(mergeImportedState(legacyState)?.version).toBe(5)
  })

  it('preserves syntactically valid progress for temporarily unavailable content', () => {
    const state = migrateStudyStateV1(legacyState)
    const imported = mergeImportedState({
      ...state,
      stageProgress: { ...state.stageProgress, 'future:removed-stage': { note: '保留我' } },
    })
    expect(imported?.stageProgress['future:removed-stage'].note).toBe('保留我')
  })

  it('falls back inside the same chapter when the saved stage no longer exists', () => {
    const state = migrateStudyStateV1(legacyState)
    const imported = mergeImportedState({
      ...state,
      location: { kind: 'stage', ref: { chapterId: 'agent', stageId: 'removed-stage' } },
    })
    expect(imported?.location).toEqual({ kind: 'chapter-map', chapterId: 'agent' })
    expect(imported?.lastStageByChapter.agent).toBe('planning')
    expect(imported?.stageProgress['agent:planning'].note).toBe('先拆计划，再调用工具。')
  })

  it('permanently maps and migrates all fifteen legacy Agent stages', () => {
    const ids = Array.from({ length: 15 }, (_, index) => index + 1)
    const agent = getChapter('agent')!
    expect(ids.map((id) => LEGACY_AGENT_STAGE_MAP[id])).toEqual(
      flattenChapter(agent).map((stage) => stage.id),
    )

    const quizResults: StudyStateV1['quizResults'] = {}
    const notes: StudyStateV1['notes'] = {}
    for (const id of ids) {
      quizResults[id] = {
        score: 100,
        passed: true,
        answeredAt: `2026-01-${String(id).padStart(2, '0')}T00:00:00.000Z`,
        wrongQuestionIds: [],
        attempt: id,
      }
      notes[id] = `旧笔记 ${id}`
    }
    const migrated = migrateStudyStateV1({
      version: 1,
      currentStageId: 15,
      completedStageIds: ids,
      quizResults,
      notes,
      reviewQueue: ids.map((stageId, index) => ({
        stageId,
        dueAt: '2026-02-01T00:00:00.000Z',
        intervalIndex: index % 5,
      })),
      timerMinutes: 15,
      focusSessions: ids.map((stageId) => ({
        stageId,
        completedAt: '2026-02-01T01:00:00.000Z',
        minutes: 15,
      })),
    })

    expect(Object.keys(migrated.stageProgress)).toHaveLength(15)
    expect(migrated.stageProgress['agent:acceptance-iteration'].note).toBe('旧笔记 15')
    expect(migrated.reviewQueue).toHaveLength(15)
    expect(migrated.focusSessions).toHaveLength(15)
    expect(migrated.current).toEqual({ chapterId: 'agent', stageId: 'acceptance-iteration' })
  })

  it('migrates v3 without changing its learning data and keeps the v3 backup intact', () => {
    const v3: StudyStateV3 = {
      version: 3,
      location: { kind: 'stage', ref: { chapterId: 'agent', stageId: 'planning' } },
      lastStageByChapter: { agent: 'planning' },
      chapterOverviewSeen: { agent: true },
      stageProgress: { 'agent:planning': { note: '保留笔记' } },
      reviewQueue: [],
      timerMinutes: 20,
      focusSessions: [],
    }
    const values = new Map<string, string>([[V3_STORAGE_KEY, JSON.stringify(v3)]])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    const migrated = loadStudyState(storage)
    expect(migrated).toEqual({ ...v3, version: 5, favoriteQuestions: [], practiceSubmissions: {} })
    expect(values.get(V3_STORAGE_KEY)).toBe(JSON.stringify(v3))
    expect(JSON.parse(values.get(STORAGE_KEY)!).version).toBe(5)
    expect(migrateStudyStateV4(migrateStudyStateV3(v3))).toEqual(migrated)
  })

  it('keeps favorite references unique and rejects malformed favorites', () => {
    const state = migrateStudyStateV3(migrateStudyStateV2(migrateStudyStateV1(legacyState)))
    const favorite = {
      stage: { chapterId: 'agent', stageId: 'planning' },
      questionId: 'planning-scenario-1',
      savedAt: '2026-08-13T00:00:00.000Z',
    }
    expect(mergeImportedState({ ...state, favoriteQuestions: [favorite, favorite] })).toBeNull()
    expect(mergeImportedState({ ...state, favoriteQuestions: [{ ...favorite, savedAt: 'not-a-date' }] })).toBeNull()
    expect(mergeImportedState({ ...state, favoriteQuestions: [favorite] })?.favoriteQuestions).toEqual([favorite])
  })
})

describe('review scheduling', () => {
  const stage = { chapterId: 'agent', stageId: 'planning' }
  const start = new Date('2026-01-01T00:00:00.000Z')

  it('creates the 1, 3, 7, 14 and 30 day queue and returns only due items', () => {
    const queue = createReviewQueue(stage, start)
    expect(queue.map((item) => item.dueAt)).toEqual([
      '2026-01-02T00:00:00.000Z',
      '2026-01-04T00:00:00.000Z',
      '2026-01-08T00:00:00.000Z',
      '2026-01-15T00:00:00.000Z',
      '2026-01-31T00:00:00.000Z',
    ])
    expect(dueReviews(queue, new Date('2026-01-04T00:00:00.000Z'))).toHaveLength(2)
  })

  it('removes a passed review and retries a failed review one day later', () => {
    const queue = createReviewQueue(stage, start)
    expect(rescheduleReview(queue, queue[0], true, start)).toHaveLength(4)
    const failed = rescheduleReview(queue, queue[0], false, start)
    expect(failed).toHaveLength(5)
    expect(failed.find((item) => item.intervalIndex === 0)?.dueAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('collapses several overdue nodes for one stage after a single review', () => {
    const queue = createReviewQueue(stage, start)
    const reviewDay = new Date('2026-01-10T00:00:00.000Z')
    const passed = rescheduleReview(queue, queue[0], true, reviewDay)
    expect(passed.map((item) => item.intervalIndex)).toEqual([3, 4])

    const failed = rescheduleReview(queue, queue[0], false, reviewDay)
    expect(failed.map((item) => item.intervalIndex)).toEqual([0, 3, 4])
    expect(failed[0].dueAt).toBe('2026-01-11T00:00:00.000Z')
  })
})

describe('weekly focus time', () => {
  const stage = { chapterId: 'agent', stageId: 'planning' }

  it('starts at local Monday midnight and excludes the previous week', () => {
    const now = new Date(2026, 7, 19, 12, 0, 0)
    const monday = new Date(2026, 7, 17, 0, 0, 0)
    const previousSunday = new Date(2026, 7, 16, 23, 59, 59)
    expect(startOfLocalWeek(now).getTime()).toBe(monday.getTime())
    expect(focusMinutesThisWeek([
      { stage, completedAt: previousSunday.toISOString(), minutes: 40 },
      { stage, completedAt: monday.toISOString(), minutes: 25 },
      { stage, completedAt: new Date(2026, 7, 18, 20, 0, 0).toISOString(), minutes: 50 },
    ], now)).toBe(75)
  })

  it('formats empty, minute-only, hour-only, and mixed durations', () => {
    expect(formatFocusDuration(0)).toBe('0 分钟')
    expect(formatFocusDuration(25)).toBe('25 分钟')
    expect(formatFocusDuration(120)).toBe('2 小时')
    expect(formatFocusDuration(135)).toBe('2 小时 15 分钟')
  })
})
