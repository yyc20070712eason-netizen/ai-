import type { StudyStateV5 } from '../types'
import { mergeImportedState } from './study'

export const ARCHIVE_VERSION = 4 as const

export type StudyArchiveV4 = {
  version: typeof ARCHIVE_VERSION
  study: StudyStateV5
  workspace?: Record<string, unknown>
}

export type ParsedStudyArchive = {
  study: StudyStateV5
  workspace?: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createStudyArchive(
  study: StudyStateV5,
  workspace?: Record<string, unknown>,
): StudyArchiveV4 {
  return {
    version: ARCHIVE_VERSION,
    study,
    ...(workspace ? { workspace } : {}),
  }
}

export function parseStudyArchive(value: unknown): ParsedStudyArchive | null {
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'study')) {
    if (value.version !== ARCHIVE_VERSION) return null
    const study = mergeImportedState(value.study)
    if (!study) return null
    if (value.workspace !== undefined && !isRecord(value.workspace)) return null
    return {
      study,
      ...(value.workspace ? { workspace: value.workspace } : {}),
    }
  }

  const study = mergeImportedState(value)
  return study ? { study } : null
}
