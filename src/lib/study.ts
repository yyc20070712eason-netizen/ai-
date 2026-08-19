import { LEGACY_AGENT_STAGE_MAP } from '../content/chapters/agent'
import {
  flattenChapter,
  getChapter,
  getFirstIncompleteStage,
  getStage,
  resolveStageRef,
} from '../content/registry'
import { ID_PATTERN, makeStageKey, parseStageKey } from '../content/schema'
import type {
  QuizQuestion,
  QuizResult,
  FavoriteQuestionRef,
  FocusSession,
  ReviewItem,
  StageProgress,
  StageRef,
  StudyStateV1,
  StudyStateV2,
  StudyStateV3,
  StudyStateV4,
  StudyStateV5,
  PracticeSubmission,
} from '../types'

export const STUDY_STATE_VERSION = 5 as const
export const STORAGE_KEY = `ai-study:v${STUDY_STATE_VERSION}`
export const V4_STORAGE_KEY = 'ai-study:v4'
export const V3_STORAGE_KEY = 'ai-study:v3'
export const V2_STORAGE_KEY = 'ai-study:v2'
export const LEGACY_STORAGE_KEY = 'ai-study:v1'
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const
export const TIMER_PRESETS = [10, 15, 20, 25] as const

const DAY_IN_MS = 86_400_000

export function startOfLocalWeek(now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

export function focusMinutesThisWeek(sessions: FocusSession[], now = new Date()) {
  const start = startOfLocalWeek(now).getTime()
  const end = now.getTime()
  return sessions.reduce((total, session) => {
    const completedAt = Date.parse(session.completedAt)
    return completedAt >= start && completedAt <= end ? total + session.minutes : total
  }, 0)
}

export function formatFocusDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  if (safeMinutes === 0) return '0 分钟'
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60
  if (hours === 0) return `${remainder} 分钟`
  if (remainder === 0) return `${hours} 小时`
  return `${hours} 小时 ${remainder} 分钟`
}

export function createDefaultStudyState(): StudyStateV5 {
  const current = resolveStageRef()
  return {
    version: STUDY_STATE_VERSION,
    location: { kind: 'chapter-map', chapterId: current.chapterId },
    lastStageByChapter: { [current.chapterId]: current.stageId },
    chapterOverviewSeen: {},
    stageProgress: {},
    reviewQueue: [],
    timerMinutes: 15,
    focusSessions: [],
    favoriteQuestions: [],
    practiceSubmissions: {},
  }
}

export const defaultStudyState: StudyStateV5 = createDefaultStudyState()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value))
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function parseStageRef(value: unknown): StageRef | null {
  if (!isRecord(value) || !isValidId(value.chapterId) || !isValidId(value.stageId)) return null
  return { chapterId: value.chapterId, stageId: value.stageId }
}

function parseQuizResult(value: unknown): QuizResult | null {
  if (!isRecord(value)) return null
  if (!Number.isFinite(value.score) || (value.score as number) < 0 || (value.score as number) > 100) return null
  if (typeof value.passed !== 'boolean' || !isValidDate(value.answeredAt)) return null
  if (!Number.isInteger(value.attempt) || (value.attempt as number) < 0) return null
  if (!Array.isArray(value.wrongQuestionIds) || !value.wrongQuestionIds.every(isValidId)) return null
  return {
    score: value.score as number,
    passed: value.passed,
    answeredAt: value.answeredAt,
    wrongQuestionIds: [...value.wrongQuestionIds],
    attempt: value.attempt as number,
  }
}

function parseStageProgress(value: unknown): StageProgress | null {
  if (!isRecord(value)) return null
  if (value.completedAt !== undefined && !isValidDate(value.completedAt)) return null
  if (value.note !== undefined && typeof value.note !== 'string') return null
  if (value.weak !== undefined && typeof value.weak !== 'boolean') return null
  if (value.firstOpenedAt !== undefined && !isValidDate(value.firstOpenedAt)) return null
  if (value.lastOpenedAt !== undefined && !isValidDate(value.lastOpenedAt)) return null
  const quizResult = value.quizResult === undefined ? undefined : parseQuizResult(value.quizResult)
  if (value.quizResult !== undefined && !quizResult) return null
  return {
    ...(value.completedAt ? { completedAt: value.completedAt as string } : {}),
    ...(quizResult ? { quizResult } : {}),
    ...(value.note !== undefined ? { note: value.note as string } : {}),
    ...(value.weak !== undefined ? { weak: value.weak as boolean } : {}),
    ...(value.firstOpenedAt !== undefined ? { firstOpenedAt: value.firstOpenedAt as string } : {}),
    ...(value.lastOpenedAt !== undefined ? { lastOpenedAt: value.lastOpenedAt as string } : {}),
  }
}

function parseReviewItem(value: unknown): ReviewItem | null {
  if (!isRecord(value)) return null
  const stage = parseStageRef(value.stage)
  if (!stage || !isValidDate(value.dueAt)) return null
  if (!Number.isInteger(value.intervalIndex) || (value.intervalIndex as number) < 0 || (value.intervalIndex as number) >= REVIEW_INTERVALS.length) return null
  return { stage, dueAt: value.dueAt, intervalIndex: value.intervalIndex as number }
}

function parseV2(value: unknown): StudyStateV2 | null {
  if (!isRecord(value) || value.version !== 2) return null
  const requestedCurrent = parseStageRef(value.current)
  if (!requestedCurrent || !isRecord(value.lastStageByChapter) || !isRecord(value.stageProgress)) return null
  if (!Array.isArray(value.reviewQueue) || !Array.isArray(value.focusSessions)) return null
  if (!TIMER_PRESETS.includes(value.timerMinutes as (typeof TIMER_PRESETS)[number])) return null

  const lastStageByChapter: Record<string, string> = {}
  for (const [chapterId, stageId] of Object.entries(value.lastStageByChapter)) {
    if (!isValidId(chapterId) || !isValidId(stageId)) return null
    lastStageByChapter[chapterId] = stageId
  }

  const stageProgress = {} as StudyStateV2['stageProgress']
  for (const [key, rawProgress] of Object.entries(value.stageProgress)) {
    const progress = parseStageProgress(rawProgress)
    if (!parseStageKey(key) || !progress) return null
    stageProgress[key as keyof typeof stageProgress] = progress
  }

  const reviewQueue: ReviewItem[] = []
  for (const rawItem of value.reviewQueue) {
    const item = parseReviewItem(rawItem)
    if (!item) return null
    reviewQueue.push(item)
  }

  const focusSessions: StudyStateV2['focusSessions'] = []
  for (const rawSession of value.focusSessions) {
    if (!isRecord(rawSession)) return null
    const stage = parseStageRef(rawSession.stage)
    if (!stage || !isValidDate(rawSession.completedAt)) return null
    if (!Number.isFinite(rawSession.minutes) || (rawSession.minutes as number) <= 0 || (rawSession.minutes as number) > 600) return null
    focusSessions.push({ stage, completedAt: rawSession.completedAt, minutes: rawSession.minutes as number })
  }

  const completed = new Set(
    Object.entries(stageProgress)
      .filter(([, progress]) => Boolean(progress.completedAt))
      .map(([key]) => key),
  )
  const requestedChapter = getChapter(requestedCurrent.chapterId)
  const current = getStage(requestedCurrent)
    ? requestedCurrent
    : requestedChapter
      ? getFirstIncompleteStage(requestedChapter.id, completed)
        ?? {
          chapterId: requestedChapter.id,
          stageId: flattenChapter(requestedChapter)[0].id,
        }
      : resolveStageRef()
  lastStageByChapter[current.chapterId] = current.stageId
  return {
    version: 2,
    current,
    lastStageByChapter,
    stageProgress,
    reviewQueue,
    timerMinutes: value.timerMinutes as number,
    focusSessions,
  }
}

function parseLocation(value: unknown): StudyStateV3['location'] | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'chapter-map' && isValidId(value.chapterId) && getChapter(value.chapterId)) {
    return { kind: 'chapter-map', chapterId: value.chapterId }
  }
  if (value.kind === 'stage') {
    const ref = parseStageRef(value.ref)
    if (ref && getStage(ref)) return { kind: 'stage', ref }
  }
  return null
}

function parseV3(value: unknown): StudyStateV3 | null {
  if (!isRecord(value) || value.version !== 3) return null
  const location = parseLocation(value.location)
  if (!location || !isRecord(value.lastStageByChapter) || !isRecord(value.chapterOverviewSeen) || !isRecord(value.stageProgress)) return null
  if (!Array.isArray(value.reviewQueue) || !Array.isArray(value.focusSessions)) return null
  if (!TIMER_PRESETS.includes(value.timerMinutes as (typeof TIMER_PRESETS)[number])) return null

  const lastStageByChapter: Record<string, string> = {}
  for (const [chapterId, stageId] of Object.entries(value.lastStageByChapter)) {
    if (!isValidId(chapterId) || !isValidId(stageId)) return null
    lastStageByChapter[chapterId] = stageId
  }
  const chapterOverviewSeen: Record<string, boolean> = {}
  for (const [chapterId, seen] of Object.entries(value.chapterOverviewSeen)) {
    if (!isValidId(chapterId) || typeof seen !== 'boolean') return null
    chapterOverviewSeen[chapterId] = seen
  }
  const stageProgress = {} as StudyStateV3['stageProgress']
  for (const [key, rawProgress] of Object.entries(value.stageProgress)) {
    const progress = parseStageProgress(rawProgress)
    if (!parseStageKey(key) || !progress) return null
    stageProgress[key as keyof typeof stageProgress] = progress
  }
  const reviewQueue: ReviewItem[] = []
  for (const rawItem of value.reviewQueue) {
    const item = parseReviewItem(rawItem)
    if (!item) return null
    reviewQueue.push(item)
  }
  const focusSessions: StudyStateV3['focusSessions'] = []
  for (const rawSession of value.focusSessions) {
    if (!isRecord(rawSession)) return null
    const stage = parseStageRef(rawSession.stage)
    if (!stage || !isValidDate(rawSession.completedAt)) return null
    if (!Number.isFinite(rawSession.minutes) || (rawSession.minutes as number) <= 0 || (rawSession.minutes as number) > 600) return null
    focusSessions.push({ stage, completedAt: rawSession.completedAt, minutes: rawSession.minutes as number })
  }
  return {
    version: 3,
    location,
    lastStageByChapter,
    chapterOverviewSeen,
    stageProgress,
    reviewQueue,
    timerMinutes: value.timerMinutes as number,
    focusSessions,
  }
}

export function migrateStudyStateV2(value: StudyStateV2): StudyStateV3 {
  const current = resolveStageRef(value.current)
  return {
    version: 3,
    location: { kind: 'chapter-map', chapterId: current.chapterId },
    lastStageByChapter: { ...value.lastStageByChapter, [current.chapterId]: current.stageId },
    chapterOverviewSeen: {},
    stageProgress: value.stageProgress,
    reviewQueue: value.reviewQueue,
    timerMinutes: value.timerMinutes,
    focusSessions: value.focusSessions,
  }
}

function parseFavoriteQuestion(value: unknown): FavoriteQuestionRef | null {
  if (!isRecord(value)) return null
  const stage = parseStageRef(value.stage)
  if (!stage || !isValidId(value.questionId) || !isValidDate(value.savedAt)) return null
  return { stage, questionId: value.questionId, savedAt: value.savedAt }
}

function favoriteKey(value: FavoriteQuestionRef) {
  return `${makeStageKey(value.stage)}:${value.questionId}`
}

function parseV4(value: unknown): StudyStateV4 | null {
  if (!isRecord(value) || value.version !== 4 || !Array.isArray(value.favoriteQuestions)) return null
  const base = parseV3({ ...value, version: 3 })
  if (!base) return null
  const favorites: FavoriteQuestionRef[] = []
  const seen = new Set<string>()
  for (const rawFavorite of value.favoriteQuestions) {
    const favorite = parseFavoriteQuestion(rawFavorite)
    if (!favorite || seen.has(favoriteKey(favorite))) return null
    seen.add(favoriteKey(favorite))
    favorites.push(favorite)
  }
  return { ...base, version: 4, favoriteQuestions: favorites }
}

function parsePracticeSubmission(value: unknown): PracticeSubmission | null {
  if (!isRecord(value) || !isRecord(value.answers) || !Array.isArray(value.checkedRubricIds) || !isValidDate(value.draftUpdatedAt) || !Number.isInteger(value.revisionCount) || (value.revisionCount as number) < 0) return null
  if (value.submittedAt !== undefined && !isValidDate(value.submittedAt)) return null
  const answers: Record<string, string> = {}
  for (const [id, answer] of Object.entries(value.answers)) {
    if (!isValidId(id) || typeof answer !== 'string' || answer.length > 20_000) return null
    answers[id] = answer
  }
  if (!value.checkedRubricIds.every(isValidId)) return null
  let feedback: PracticeSubmission['feedback']
  if (value.feedback !== undefined) {
    if (!isRecord(value.feedback) || !Array.isArray(value.feedback.strengths) || !Array.isArray(value.feedback.gaps) || !Array.isArray(value.feedback.rubric) || typeof value.feedback.nextStep !== 'string' || !Number.isFinite(value.feedback.inputTokens) || !Number.isFinite(value.feedback.outputTokens) || !isValidDate(value.feedback.createdAt)) return null
    const rules = value.feedback.rubric.map((item) => isRecord(item) && isValidId(item.id) && ['met', 'partial', 'missing'].includes(item.status as string) && typeof item.note === 'string' ? { id: item.id as string, status: item.status as 'met' | 'partial' | 'missing', note: item.note as string } : null)
    if (rules.some((item) => !item)) return null
    feedback = { strengths: value.feedback.strengths.filter((item): item is string => typeof item === 'string').slice(0, 3), gaps: value.feedback.gaps.filter((item): item is string => typeof item === 'string').slice(0, 3), rubric: rules as NonNullable<typeof feedback>['rubric'], nextStep: value.feedback.nextStep, inputTokens: value.feedback.inputTokens as number, outputTokens: value.feedback.outputTokens as number, createdAt: value.feedback.createdAt as string }
  }
  return { answers, checkedRubricIds: [...value.checkedRubricIds], draftUpdatedAt: value.draftUpdatedAt as string, ...(value.submittedAt ? { submittedAt: value.submittedAt as string } : {}), revisionCount: value.revisionCount as number, ...(feedback ? { feedback } : {}) }
}

function parseV5(value: unknown): StudyStateV5 | null {
  if (!isRecord(value) || value.version !== STUDY_STATE_VERSION || !isRecord(value.practiceSubmissions)) return null
  const base = parseV4({ ...value, version: 4 })
  if (!base) return null
  const practiceSubmissions: StudyStateV5['practiceSubmissions'] = {}
  for (const [key, raw] of Object.entries(value.practiceSubmissions)) {
    if (!parseStageKey(key)) return null
    const submission = parsePracticeSubmission(raw)
    if (!submission) return null
    practiceSubmissions[key as keyof StudyStateV5['practiceSubmissions']] = submission
  }
  return { ...base, version: STUDY_STATE_VERSION, practiceSubmissions }
}

export function migrateStudyStateV3(value: StudyStateV3): StudyStateV4 {
  return { ...value, version: 4, favoriteQuestions: [] }
}

export function migrateStudyStateV4(value: StudyStateV4): StudyStateV5 {
  return { ...value, version: STUDY_STATE_VERSION, practiceSubmissions: {} }
}

function parseV1(value: unknown): StudyStateV1 | null {
  if (!isRecord(value) || value.version !== 1) return null
  if (!Number.isInteger(value.currentStageId) || !LEGACY_AGENT_STAGE_MAP[value.currentStageId as number]) return null
  if (!Array.isArray(value.completedStageIds) || !value.completedStageIds.every((id) => Number.isInteger(id) && Boolean(LEGACY_AGENT_STAGE_MAP[id]))) return null
  if (value.quizResults !== undefined && !isRecord(value.quizResults)) return null
  if (value.notes !== undefined && !isRecord(value.notes)) return null
  if (value.reviewQueue !== undefined && !Array.isArray(value.reviewQueue)) return null
  if (value.focusSessions !== undefined && !Array.isArray(value.focusSessions)) return null
  const timerMinutes = value.timerMinutes ?? 15
  if (!TIMER_PRESETS.includes(timerMinutes as (typeof TIMER_PRESETS)[number])) return null

  const quizResults: StudyStateV1['quizResults'] = {}
  for (const [rawStageId, rawResult] of Object.entries(value.quizResults ?? {})) {
    const stageId = Number(rawStageId)
    const result = parseQuizResult(rawResult)
    if (!Number.isInteger(stageId) || !LEGACY_AGENT_STAGE_MAP[stageId] || !result) return null
    quizResults[stageId] = result
  }

  const notes: StudyStateV1['notes'] = {}
  for (const [rawStageId, note] of Object.entries(value.notes ?? {})) {
    const stageId = Number(rawStageId)
    if (!Number.isInteger(stageId) || !LEGACY_AGENT_STAGE_MAP[stageId] || typeof note !== 'string') return null
    notes[stageId] = note
  }

  const reviewQueue: StudyStateV1['reviewQueue'] = []
  for (const item of value.reviewQueue ?? []) {
    if (!isRecord(item) || !Number.isInteger(item.stageId) || !LEGACY_AGENT_STAGE_MAP[item.stageId as number]) return null
    if (!isValidDate(item.dueAt) || !Number.isInteger(item.intervalIndex) || (item.intervalIndex as number) < 0 || (item.intervalIndex as number) >= REVIEW_INTERVALS.length) return null
    reviewQueue.push({ stageId: item.stageId as number, dueAt: item.dueAt, intervalIndex: item.intervalIndex as number })
  }

  const focusSessions: StudyStateV1['focusSessions'] = []
  for (const session of value.focusSessions ?? []) {
    if (!isRecord(session) || !Number.isInteger(session.stageId) || !LEGACY_AGENT_STAGE_MAP[session.stageId as number]) return null
    if (!isValidDate(session.completedAt) || !Number.isFinite(session.minutes) || (session.minutes as number) <= 0 || (session.minutes as number) > 600) return null
    focusSessions.push({ stageId: session.stageId as number, completedAt: session.completedAt, minutes: session.minutes as number })
  }

  return {
    version: 1,
    currentStageId: value.currentStageId as number,
    completedStageIds: [...new Set(value.completedStageIds as number[])],
    quizResults,
    notes,
    reviewQueue,
    timerMinutes: timerMinutes as number,
    focusSessions,
  }
}

export function migrateStudyStateV1(value: StudyStateV1, now = new Date()): StudyStateV2 {
  const fallbackCompletedAt = now.toISOString()
  const current: StageRef = {
    chapterId: 'agent',
    stageId: LEGACY_AGENT_STAGE_MAP[value.currentStageId],
  }
  const stageProgress = {} as StudyStateV2['stageProgress']
  const legacyStageIds = new Set([
    ...value.completedStageIds,
    ...Object.keys(value.quizResults).map(Number),
    ...Object.keys(value.notes).map(Number),
  ])

  for (const legacyStageId of legacyStageIds) {
    const stageId = LEGACY_AGENT_STAGE_MAP[legacyStageId]
    if (!stageId) continue
    const quizResult = value.quizResults[legacyStageId]
    const completed = value.completedStageIds.includes(legacyStageId)
    stageProgress[makeStageKey({ chapterId: 'agent', stageId })] = {
      ...(completed ? { completedAt: quizResult?.answeredAt ?? fallbackCompletedAt } : {}),
      ...(quizResult ? { quizResult, weak: !quizResult.passed } : {}),
      ...(Object.prototype.hasOwnProperty.call(value.notes, legacyStageId) ? { note: value.notes[legacyStageId] } : {}),
    }
  }

  return {
    version: 2,
    current: resolveStageRef(current),
    lastStageByChapter: { agent: current.stageId },
    stageProgress,
    reviewQueue: value.reviewQueue.map((item) => ({
      stage: { chapterId: 'agent', stageId: LEGACY_AGENT_STAGE_MAP[item.stageId] },
      dueAt: item.dueAt,
      intervalIndex: item.intervalIndex,
    })),
    timerMinutes: value.timerMinutes,
    focusSessions: value.focusSessions.map((session) => ({
      stage: { chapterId: 'agent', stageId: LEGACY_AGENT_STAGE_MAP[session.stageId] },
      completedAt: session.completedAt,
      minutes: session.minutes,
    })),
  }
}

export function mergeImportedState(value: unknown): StudyStateV5 | null {
  const v5 = parseV5(value)
  if (v5) return v5
  const v4 = parseV4(value)
  if (v4) return migrateStudyStateV4(v4)
  const v3 = parseV3(value)
  if (v3) return migrateStudyStateV4(migrateStudyStateV3(v3))
  const v2 = parseV2(value)
  if (v2) return migrateStudyStateV4(migrateStudyStateV3(migrateStudyStateV2(v2)))
  const v1 = parseV1(value)
  return v1 ? migrateStudyStateV4(migrateStudyStateV3(migrateStudyStateV2(migrateStudyStateV1(v1)))) : null
}

export function loadStudyState(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): StudyStateV5 {
  let currentRaw: string | null = null
  let v4Raw: string | null = null
  let v3Raw: string | null = null
  let v2Raw: string | null = null
  let legacyRaw: string | null = null
  try {
    currentRaw = storage.getItem(STORAGE_KEY)
    v4Raw = storage.getItem(V4_STORAGE_KEY)
    v3Raw = storage.getItem(V3_STORAGE_KEY)
    v2Raw = storage.getItem(V2_STORAGE_KEY)
    legacyRaw = storage.getItem(LEGACY_STORAGE_KEY)
  } catch {
    return createDefaultStudyState()
  }

  if (currentRaw) {
    try {
      const current = mergeImportedState(JSON.parse(currentRaw))
      if (current?.version === 5) return current
    } catch {
      // A corrupt v4 value may still be recoverable from a preserved older value.
    }
  }

  if (v4Raw) {
    try {
      const v4 = parseV4(JSON.parse(v4Raw))
      if (v4) {
        const migrated = migrateStudyStateV4(v4)
        try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)) } catch { /* keep in memory */ }
        return migrated
      }
    } catch { /* fall through */ }
  }

  if (v3Raw) {
    try {
      const v3 = parseV3(JSON.parse(v3Raw))
      if (v3) {
        const migrated = migrateStudyStateV4(migrateStudyStateV3(v3))
        try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)) } catch { /* keep in memory */ }
        return migrated
      }
    } catch {
      // Fall through to the v2 backup.
    }
  }

  if (v2Raw) {
    try {
      const v2 = parseV2(JSON.parse(v2Raw))
      if (v2) {
        const migrated = migrateStudyStateV4(migrateStudyStateV3(migrateStudyStateV2(v2)))
        try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)) } catch { /* keep in memory */ }
        return migrated
      }
    } catch {
      // Fall through to the v1 backup.
    }
  }

  if (legacyRaw) {
    try {
      const legacy = parseV1(JSON.parse(legacyRaw))
      if (legacy) {
        const migrated = migrateStudyStateV4(migrateStudyStateV3(migrateStudyStateV2(migrateStudyStateV1(legacy))))
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        } catch {
          // Migration still succeeds in memory when storage is temporarily unavailable.
        }
        return migrated
      }
    } catch {
      // Fall through to a clean state when both stored versions are unusable.
    }
  }
  return createDefaultStudyState()
}

export function saveStudyState(state: StudyStateV5, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function hashSeed(value: string) {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

function shuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items]
  const random = seededRandom(hashSeed(seed))
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function sampleQuiz(bank: QuizQuestion[], stageKey: string, attempt = 0): QuizQuestion[] {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error('测验次数必须是非负整数')
  const scenarios = bank.filter((question) => question.scenario)
  const knowledge = bank.filter((question) => !question.scenario)
  const critical = scenarios.filter((question) => question.critical)
  if (scenarios.length < 3 || knowledge.length < 2 || critical.length === 0) {
    throw new Error('题库必须包含至少 3 道场景题、2 道知识题和 1 道关键场景题')
  }

  const seed = `${stageKey}|${attempt}|${bank.map((question) => question.id).join('|')}`
  const pickedCritical = shuffle(critical, `${seed}|critical`)[0]
  const otherScenarios = scenarios.filter((question) => question.id !== pickedCritical.id)
  const pickedScenarios = [pickedCritical, ...shuffle(otherScenarios, `${seed}|scenario`).slice(0, 2)]
  const pickedKnowledge = shuffle(knowledge, `${seed}|knowledge`).slice(0, 2)
  return shuffle([...pickedScenarios, ...pickedKnowledge], `${seed}|order`)
}

export function gradeQuiz(
  questions: QuizQuestion[],
  answers: Record<string, string>,
  attempt: number,
  now = new Date(),
): QuizResult {
  if (questions.length === 0) throw new Error('测验不能为空')
  const correct = questions.filter((question) => answers[question.id] === question.answer)
  const criticalCorrect = questions
    .filter((question) => question.critical)
    .every((question) => answers[question.id] === question.answer)
  const score = Math.round((correct.length / questions.length) * 100)
  return {
    score,
    passed: score >= 80 && criticalCorrect,
    answeredAt: now.toISOString(),
    wrongQuestionIds: questions
      .filter((question) => answers[question.id] !== question.answer)
      .map((question) => question.id),
    attempt,
  }
}

export function createReviewQueue(stage: StageRef, from = new Date()): ReviewItem[] {
  return REVIEW_INTERVALS.map((days, intervalIndex) => ({
    stage: { ...stage },
    dueAt: new Date(from.getTime() + days * DAY_IN_MS).toISOString(),
    intervalIndex,
  }))
}

export function dueReviews(queue: ReviewItem[], now = new Date()) {
  return queue
    .filter((item) => new Date(item.dueAt).getTime() <= now.getTime())
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.intervalIndex - b.intervalIndex)
}

export function rescheduleReview(
  queue: ReviewItem[],
  reviewed: ReviewItem,
  passed: boolean,
  from = new Date(),
): ReviewItem[] {
  const reviewedKey = makeStageKey(reviewed.stage)
  const remaining = queue.filter(
    (item) => makeStageKey(item.stage) !== reviewedKey
      || (item.intervalIndex !== reviewed.intervalIndex && Date.parse(item.dueAt) > from.getTime()),
  )
  if (!passed) {
    remaining.push({
      stage: { ...reviewed.stage },
      dueAt: new Date(from.getTime() + DAY_IN_MS).toISOString(),
      intervalIndex: reviewed.intervalIndex,
    })
  }
  return remaining.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.intervalIndex - b.intervalIndex)
}
