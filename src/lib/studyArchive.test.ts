import { describe, expect, it, vi } from 'vitest'
import type { StageKey, StudyStateV1, StudyStateV4 } from '../types'

vi.mock('../content/registry', () => {
  const defaultRef = { chapterId: 'agent', stageId: 'what-is-agent' }
  return {
    flattenChapter: () => [{ id: defaultRef.stageId }],
    getChapter: (chapterId: string) => chapterId === defaultRef.chapterId ? { id: chapterId } : null,
    getFirstIncompleteStage: () => defaultRef,
    getStage: (ref: { chapterId: string; stageId: string }) => ref.chapterId === defaultRef.chapterId ? { id: ref.stageId } : null,
    resolveStageRef: (ref?: { chapterId: string; stageId: string }) => ref ?? defaultRef,
  }
})

import {
  createDefaultStudyState,
  migrateStudyStateV1,
  migrateStudyStateV2,
  migrateStudyStateV3,
  STUDY_STATE_VERSION,
} from './study'
import {
  ARCHIVE_VERSION,
  createStudyArchive,
  parseStudyArchive,
} from './studyArchive'

function stateWithPractice() {
  const state = createDefaultStudyState()
  const stageKey = 'agent:what-is-agent' as StageKey
  state.practiceSubmissions[stageKey] = {
    answers: { goal: '查询订单并返回可核验状态。' },
    checkedRubricIds: ['proof'],
    draftUpdatedAt: '2026-08-18T00:00:00.000Z',
    submittedAt: '2026-08-18T00:01:00.000Z',
    revisionCount: 0,
  }
  return state
}

const legacyV1: StudyStateV1 = {
  version: 1,
  currentStageId: 1,
  completedStageIds: [],
  quizResults: {},
  notes: {},
  reviewQueue: [],
  timerMinutes: 15,
  focusSessions: [],
}

describe('study archive v4', () => {
  it('round-trips a v5 study state with practice submissions and workspace data', () => {
    const study = stateWithPractice()
    const workspace = { artifacts: [], answers: [], summaries: [], archiveStates: [] }
    const archive = createStudyArchive(study, workspace)

    expect(archive.version).toBe(ARCHIVE_VERSION)
    expect(archive.study.version).toBe(STUDY_STATE_VERSION)
    expect(parseStudyArchive(archive)).toEqual({ study, workspace })
  })

  it('accepts historical v4 wrapped archives and migrates their nested state', () => {
    const current = createDefaultStudyState()
    const { practiceSubmissions: _practiceSubmissions, ...withoutPractice } = current
    const legacyStudy: StudyStateV4 = {
      ...withoutPractice,
      version: 4,
    }

    const parsed = parseStudyArchive({ version: ARCHIVE_VERSION, study: legacyStudy })
    expect(parsed?.study).toEqual({ ...legacyStudy, version: STUDY_STATE_VERSION, practiceSubmissions: {} })
  })

  it('keeps accepting bare v1-v5 study states for legacy imports', () => {
    const v2 = migrateStudyStateV1(legacyV1)
    const v3 = migrateStudyStateV2(v2)
    const v4 = migrateStudyStateV3(v3)
    const v5 = stateWithPractice()

    for (const study of [legacyV1, v2, v3, v4, v5]) {
      expect(parseStudyArchive(study)?.study.version).toBe(STUDY_STATE_VERSION)
    }
    expect(parseStudyArchive(v5)).toEqual({ study: v5 })
  })

  it('rejects unknown wrappers, malformed study data, and invalid workspace values', () => {
    const study = stateWithPractice()
    expect(parseStudyArchive({ version: 5, study })).toBeNull()
    expect(parseStudyArchive({ version: ARCHIVE_VERSION, study: { version: 999 } })).toBeNull()
    expect(parseStudyArchive({ version: ARCHIVE_VERSION, study, workspace: 'invalid' })).toBeNull()
  })
})
