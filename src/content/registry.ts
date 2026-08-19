import type { ChapterPackage, Stage, StageRef } from '../types'
import { COURSE_CHAPTER_ORDER } from './courseTopology'
import { makeStageKey, validateCatalog } from './schema'

type ChapterModule = { default: ChapterPackage }

const modules = import.meta.glob<ChapterModule>('./chapters/*/index.ts', { eager: true })
const discovered = Object.values(modules).map((module) => module.default)

export const chapters = validateCatalog(discovered).sort(
  (a, b) => COURSE_CHAPTER_ORDER.indexOf(a.id as typeof COURSE_CHAPTER_ORDER[number])
    - COURSE_CHAPTER_ORDER.indexOf(b.id as typeof COURSE_CHAPTER_ORDER[number]),
)

export function getChapters() {
  return chapters
}

export function getChapter(chapterId: string) {
  return chapters.find((chapter) => chapter.id === chapterId)
}

export function flattenChapter(chapter: ChapterPackage): Stage[] {
  const byId = new Map(chapter.stages.map((stage) => [stage.id, stage]))
  return chapter.units.flatMap((unit) => unit.stageIds.map((id) => byId.get(id)).filter((stage): stage is Stage => Boolean(stage)))
}

export function flattenCatalog(): Array<{ chapter: ChapterPackage; stage: Stage }> {
  return chapters.flatMap((chapter) => flattenChapter(chapter).map((stage) => ({ chapter, stage })))
}

export function getStage(ref: StageRef) {
  return getChapter(ref.chapterId)?.stages.find((stage) => stage.id === ref.stageId)
}

export function getUnit(ref: StageRef) {
  const chapter = getChapter(ref.chapterId)
  const stage = getStage(ref)
  return chapter?.units.find((unit) => unit.id === stage?.unitId)
}

export function getAdjacentStage(ref: StageRef, direction: 'previous' | 'next'): StageRef | null {
  const flat = flattenCatalog()
  const index = flat.findIndex(({ chapter, stage }) => chapter.id === ref.chapterId && stage.id === ref.stageId)
  const adjacent = flat[index + (direction === 'next' ? 1 : -1)]
  return adjacent ? { chapterId: adjacent.chapter.id, stageId: adjacent.stage.id } : null
}

export function getFirstIncompleteStage(chapterId: string, completed: Set<string>): StageRef | null {
  const chapter = getChapter(chapterId)
  if (!chapter) return null
  const stage = flattenChapter(chapter).find((item) => !completed.has(makeStageKey({ chapterId, stageId: item.id })))
  return stage ? { chapterId, stageId: stage.id } : null
}

export function getChapterProgress(chapterId: string, completed: Set<string>) {
  const chapter = getChapter(chapterId)
  if (!chapter) return { mastered: 0, total: 0 }
  const stages = flattenChapter(chapter)
  return {
    mastered: stages.filter((stage) => completed.has(makeStageKey({ chapterId, stageId: stage.id }))).length,
    total: stages.length,
  }
}

export function resolveStageRef(ref?: StageRef | null): StageRef {
  if (ref && getStage(ref)) return ref
  const first = flattenCatalog()[0]
  if (!first) throw new Error('课程目录没有可用关卡')
  return { chapterId: first.chapter.id, stageId: first.stage.id }
}
