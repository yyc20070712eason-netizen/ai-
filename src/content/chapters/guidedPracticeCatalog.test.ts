import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chapters, flattenChapter } from '../registry'
import { isConceptCheckPractice, isProjectStepPractice, isProjectSubmitPractice } from '../../lib/practice'

const packs = {
  'vibe-coding': 'vibe-task-board',
  transformer: 'transformer-attention-lab',
  rag: 'rag-course-retriever',
  langchain: 'langchain-learning-assistant',
  'ai-harness': 'ai-harness-workbench',
  langgraph: 'langgraph-study-flow',
} as const

describe('six chapter guided practice catalog', () => {
  it('has explicit activity modes and milestone positions', () => {
    const expected: Record<keyof typeof packs, number[]> = {
      'vibe-coding': [3, 6, 9, 12, 15], transformer: [3, 6, 9, 13, 16], rag: [3, 6, 9, 12, 18],
      langchain: [3, 6, 9, 12, 15], 'ai-harness': [3, 6, 9, 12], langgraph: [3, 6, 10, 13, 16],
    }
    for (const [chapterId, positions] of Object.entries(expected)) {
      const chapter = chapters.find((item) => item.id === chapterId)!
      const modes = flattenChapter(chapter).map((stage) => {
        if (isConceptCheckPractice(stage.practice)) return 'concept-check'
        if (isProjectStepPractice(stage.practice)) return 'project-step'
        if (isProjectSubmitPractice(stage.practice)) return 'project-submit'
        return 'legacy'
      })
      expect(modes.every((mode) => mode !== 'legacy')).toBe(true)
      expect(positions.map((position) => modes[position - 1])).toEqual(positions.map(() => 'project-submit'))
      expect(modes.filter((mode) => mode === 'project-submit')).toHaveLength(positions.length)
      for (const stage of flattenChapter(chapter)) {
        const practice = stage.practice
        if (!isProjectStepPractice(practice)) continue
        const target = chapter.stages.find((candidate) => candidate.id === practice.milestoneStageId)!
        expect(chapter.stages.indexOf(target)).toBeGreaterThan(chapter.stages.indexOf(stage))
        expect(target.unitId).toBe(stage.unitId)
      }
    }
  })

  it('ships a local starter pack for every chapter without credentials or network URLs', () => {
    for (const [chapterId, pack] of Object.entries(packs)) {
      const root = resolve(process.cwd(), 'public', 'practice', pack)
      const zip = resolve(process.cwd(), 'public', 'practice', `${pack}-starter.zip`)
      expect(existsSync(resolve(root, 'README.md')), chapterId).toBe(true)
      expect(existsSync(resolve(root, 'package.json')), chapterId).toBe(true)
      expect(existsSync(zip), chapterId).toBe(true)
      expect(statSync(zip).size).toBeGreaterThan(1000)
      const combined = readFileSync(resolve(root, 'README.md'), 'utf8') + readFileSync(resolve(root, 'package.json'), 'utf8')
      expect(combined).not.toMatch(/sk-[A-Za-z0-9]{12,}|Cookie:|https?:\/\//u)
    }
  })
})
