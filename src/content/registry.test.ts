import { describe, expect, it } from 'vitest'
import readme from '../../README.md?raw'
import type { ChapterPackage, QuizQuestion, Stage } from '../types'
import {
  chapters,
  flattenCatalog,
  flattenChapter,
  getAdjacentStage,
  getChapterProgress,
  getFirstIncompleteStage,
} from './registry'
import { makeStageKey, parseStageKey, validateCatalog } from './schema'
import { isProjectStepPractice, isProjectSubmitPractice } from '../lib/practice'
import { configuredStageIds, COURSE_CHAPTER_ORDER } from './courseTopology'

function makeQuiz(prefix: string): QuizQuestion[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `${prefix}-q-${index + 1}`,
    prompt: `Question ${index + 1}`,
    choices: [
      { id: 'a', label: 'Choice A' },
      { id: 'b', label: 'Choice B' },
      { id: 'c', label: 'Choice C' },
    ],
    answer: 'b',
    explanation: 'Choice B is correct.',
    scenario: index < 3,
    critical: index === 0,
  }))
}

function makeStage(id: string, unitId: string): Stage {
  return {
    id,
    unitId,
    title: `Stage ${id}`,
    durationMinutes: 15,
    sourceRefs: [{ sourceId: 'manual', label: `Section ${id}` }],
    problem: 'A concrete problem to solve.',
    outcome: 'A measurable learning outcome.',
    prediction: {
      prompt: 'What should happen next?',
      choices: [
        { id: 'a', label: 'First option' },
        { id: 'b', label: 'Second option' },
      ],
      answer: 'b',
      feedback: 'Use the evidence in the situation.',
    },
    lesson: [{ title: 'Core idea', paragraphs: ['A concise explanation.'] }],
    practice: {
      title: 'Apply the idea',
      brief: 'Use the idea in a small scenario.',
      success: 'The result satisfies the stated condition.',
    },
    bridge: 'Continue to the next stage.',
    quiz: makeQuiz(id),
  }
}

function makeThreeStageChapter(id = 'variable-chapter', order = 10): ChapterPackage {
  return {
    contentSchemaVersion: 1,
    id,
    title: `Chapter ${id}`,
    shortTitle: id,
    order,
    sources: [
      {
        id: 'manual',
        kind: 'remote',
        title: 'Reference manual',
        provider: 'web',
        url: 'https://example.com/manual',
        embed: 'attempt',
      },
    ],
    units: [
      { id: 'unit-one', title: 'Unit one', stageIds: ['stage-one', 'stage-two'] },
      { id: 'unit-two', title: 'Unit two', stageIds: ['stage-three'] },
    ],
    // Deliberately not in navigation order: units and stageIds own the sequence.
    stages: [
      makeStage('stage-three', 'unit-two'),
      makeStage('stage-one', 'unit-one'),
      makeStage('stage-two', 'unit-one'),
    ],
  }
}

describe('chapter catalog validation', () => {
  it('accepts a variable three-stage chapter and preserves its object', () => {
    const chapter = makeThreeStageChapter()

    expect(validateCatalog([chapter])).toEqual([chapter])
    expect(flattenChapter(chapter).map((stage) => stage.id)).toEqual([
      'stage-one',
      'stage-two',
      'stage-three',
    ])
  })

  it.each([
    ['chapter id', (chapter: ChapterPackage) => { chapter.id = 'Bad Chapter' }],
    ['source id', (chapter: ChapterPackage) => { chapter.sources[0].id = 'Bad Source' }],
    ['unit id', (chapter: ChapterPackage) => { chapter.units[0].id = 'Bad Unit' }],
    ['stage id', (chapter: ChapterPackage) => { chapter.stages[0].id = 'Bad Stage' }],
  ])('rejects an invalid %s', (_label, invalidate) => {
    const chapter = makeThreeStageChapter()
    invalidate(chapter)

    expect(() => validateCatalog([chapter])).toThrow()
  })

  it.each([
    ['unknown prerequisite', (chapter: ChapterPackage) => { chapter.prerequisites = ['missing-chapter'] }],
    ['unknown stage in a unit', (chapter: ChapterPackage) => { chapter.units[0].stageIds[0] = 'missing-stage' }],
    ['unknown unit on a stage', (chapter: ChapterPackage) => { chapter.stages[0].unitId = 'missing-unit' }],
    ['unknown source on a stage', (chapter: ChapterPackage) => { chapter.stages[0].sourceRefs[0].sourceId = 'missing-source' }],
  ])('rejects an %s reference', (_label, invalidate) => {
    const chapter = makeThreeStageChapter()
    invalidate(chapter)

    expect(() => validateCatalog([chapter])).toThrow()
  })

  it.each([
    ['fewer than eight questions', (quiz: QuizQuestion[]) => quiz.slice(0, 7)],
    ['fewer than three scenarios', (quiz: QuizQuestion[]) => quiz.map((question, index) => ({ ...question, scenario: index < 2 }))],
    ['no critical scenario', (quiz: QuizQuestion[]) => quiz.map((question) => ({ ...question, critical: false }))],
    ['an answer outside its choices', (quiz: QuizQuestion[]) => quiz.map((question, index) => index === 0 ? { ...question, answer: 'missing' } : question)],
    ['duplicate question ids', (quiz: QuizQuestion[]) => quiz.map((question, index) => index === 1 ? { ...question, id: quiz[0].id } : question)],
    ['duplicate choice ids', (quiz: QuizQuestion[]) => quiz.map((question, index) => index === 0 ? { ...question, choices: [{ id: 'a', label: 'A' }, { id: 'a', label: 'Again' }] } : question)],
    ['duplicate choice labels after whitespace normalization', (quiz: QuizQuestion[]) => quiz.map((question, index) => index === 0 ? { ...question, choices: [{ id: 'a', label: 'Same answer' }, { id: 'b', label: 'Same  answer' }] } : question)],
  ])('rejects a quiz with %s', (_label, alterQuiz) => {
    const chapter = makeThreeStageChapter()
    chapter.stages[0].quiz = alterQuiz(chapter.stages[0].quiz)

    expect(() => validateCatalog([chapter])).toThrow()
  })

  it('rejects duplicate prediction labels and invalid prediction answers', () => {
    const duplicate = makeThreeStageChapter()
    duplicate.stages[0].prediction.choices = [
      { id: 'a', label: 'Same answer' },
      { id: 'b', label: 'Same  answer' },
    ]
    expect(() => validateCatalog([duplicate])).toThrow(/重复选项文本/)

    const invalidAnswer = makeThreeStageChapter()
    invalidAnswer.stages[0].prediction.answer = 'missing'
    expect(() => validateCatalog([invalidAnswer])).toThrow(/未指向有效选项/)
  })

  it('rejects a dependency cycle across chapters', () => {
    const first = makeThreeStageChapter('chapter-one', 1)
    const second = makeThreeStageChapter('chapter-two', 2)
    const third = makeThreeStageChapter('chapter-three', 3)
    first.prerequisites = ['chapter-three']
    second.prerequisites = ['chapter-one']
    third.prerequisites = ['chapter-two']

    expect(() => validateCatalog([first, second, third])).toThrow()
  })

  it('rejects invalid cross-stage project references and incomplete milestone evidence', () => {
    const wrongTarget = structuredClone(chapters.find((chapter) => chapter.id === 'agent')!)
    const planning = wrongTarget.stages.find((stage) => stage.id === 'planning')!
    if (!isProjectStepPractice(planning.practice)) throw new Error('project step expected')
    planning.practice.milestoneStageId = 'multi-agent'
    expect(() => validateCatalog([wrongTarget])).toThrow(/同单元后续关卡/)

    const missingField = structuredClone(chapters.find((chapter) => chapter.id === 'agent')!)
    const memory = missingField.stages.find((stage) => stage.id === 'memory')!
    if (!isProjectStepPractice(memory.practice)) throw new Error('project step expected')
    memory.practice.fields = [{ ...memory.practice.fields[0], id: 'unknown-field' }]
    expect(() => validateCatalog([missingField])).toThrow(/未在目标里程碑中定义/)

    const missingEvidence = structuredClone(chapters.find((chapter) => chapter.id === 'agent')!)
    const milestone = missingEvidence.stages.find((stage) => stage.id === 'model-boundaries')!
    if (!isProjectSubmitPractice(milestone.practice)) throw new Error('project submit expected')
    milestone.practice.rubric[0].evidencePrompt = ''
    expect(() => validateCatalog([missingEvidence])).toThrow(/evidencePrompt/)
  })
})

describe('stable stage identity, navigation, and progress', () => {
  it('registers all seven production chapters with adaptive stage counts and personal Feishu sources', () => {
    expect(chapters.map((chapter) => chapter.id)).toEqual([
      'agent', 'vibe-coding', 'transformer', 'rag', 'langchain', 'ai-harness', 'langgraph',
    ])
    expect(chapters[0].stages).toHaveLength(15)
    expect(chapters.slice(1).every((chapter) => chapter.stages.length >= 12 && chapter.stages.length <= 18)).toBe(true)
    expect(chapters.slice(1).every((chapter) => chapter.units.length >= 4 && chapter.units.length <= 5)).toBe(true)
    expect(chapters.every((chapter) => chapter.sources.every((source) => (
      source.kind !== 'remote' || source.url.startsWith('https://gcnum0i2ctpz.feishu.cn/docx/')
    )))).toBe(true)
    const stageCount = flattenCatalog().length
    expect(stageCount).toBe(107)
    expect(readme).toContain(`共 ${stageCount} 个关卡`)
  })

  it('gives all 107 stages explicit v2 knowledge metadata in one topological order', () => {
    expect(chapters.map((chapter) => chapter.id)).toEqual([...COURSE_CHAPTER_ORDER])
    expect(flattenCatalog()).toHaveLength(107)
    chapters.forEach((chapter) => {
      expect(chapter.contentSchemaVersion).toBe(2)
      expect(new Set(configuredStageIds(chapter.id))).toEqual(new Set(chapter.stages.map((stage) => stage.id)))
      const ordered = flattenChapter(chapter)
      const index = new Map(ordered.map((stage, stageIndex) => [stage.id, stageIndex]))
      ordered.forEach((stage) => {
        expect(stage.knowledge?.keyConcepts.length).toBeGreaterThanOrEqual(4)
        stage.knowledge?.prerequisites.forEach((prerequisite) => {
          expect(prerequisite.chapterId).toBe(chapter.id)
          expect(index.get(prerequisite.stageId)).toBeLessThan(index.get(stage.id)!)
        })
      })
    })
  })

  it('locks all fifteen Agent prediction questions, choices, and answers', () => {
    const agent = chapters.find((chapter) => chapter.id === 'agent')!
    expect(flattenChapter(agent).map((stage) => ({
      prompt: stage.prediction.prompt,
      choices: stage.prediction.choices.map((choice) => choice.label),
      answer: stage.prediction.answer,
    }))).toEqual([
      { prompt: '让这个机器人真正完成退款，最关键的新增能力是什么？', choices: ['回答得更长', '能调用订单与退款工具', '换一个更大的模型'], answer: 'b' },
      { prompt: '订单接口已经正确返回，但 Agent 仍重复查询。优先检查哪一层？', choices: ['控制层的状态与停止条件', '交互层的字体', '换数据库品牌'], answer: 'a' },
      { prompt: '要回答实时库存，最可靠的做法是什么？', choices: ['要求模型认真回忆', '调用库存接口并引用结果', '把温度调高'], answer: 'b' },
      { prompt: '第一步最应该做什么？', choices: ['立刻写结论', '确认指标口径与数据范围', '搜索一句行业新闻就结束'], answer: 'b' },
      { prompt: '预算属于本次任务正在使用的信息，先放在哪里？', choices: ['短期状态/工作记忆', '模型参数', '公开知识库'], answer: 'a' },
      { prompt: '工具返回销售额为空后，下一步应该是什么？', choices: ['继续计算并给结论', '观察为空的原因并决定补查或追问', '重复原答案'], answer: 'b' },
      { prompt: '防止无限循环，最有效的组合是什么？', choices: ['提示它“请不要循环”', '轮数/时间预算 + 明确终态 + 重复检测', '把温度调高'], answer: 'b' },
      { prompt: '计算 2387 × 419 时优先用什么？', choices: ['搜索引擎', '计算器工具', '长期记忆'], answer: 'b' },
      { prompt: '哪种情况最值得拆成多个角色？', choices: ['只有一步固定查询', '存在清晰专业分工与可验证交接', '想让架构图更复杂'], answer: 'b' },
      { prompt: '一个可预测的三步流程，最合适的起点是什么？', choices: ['先用最小状态机或普通函数', '立即上多 Agent 框架', '同时接入四个框架'], answer: 'a' },
      { prompt: '发布前最先需要什么？', choices: ['一组真实且覆盖边界的固定测试任务', '更炫的加载动画', '删除旧日志'], answer: 'a' },
      { prompt: '这句话最可能对应什么意图？', choices: ['查询物流/催单', '修改头像', '申请发票'], answer: 'a' },
      { prompt: '这句话应该输出什么结构？', choices: ['两个有顺序的意图及各自槽位', '只保留最后一个意图', '整句话作为一个工具名'], answer: 'a' },
      { prompt: '第一版最应该砍掉什么？', choices: ['一个明确输入到一个可验收输出的主流程', '自动对外发布与无限数据源', '必要的错误提示'], answer: 'b' },
      { prompt: '第一轮迭代优先看什么？', choices: ['失败频率 × 影响程度最高的问题', '最酷的新框架', '动画是否更多'], answer: 'a' },
    ])
  })

  it('round-trips namespaced stage keys and rejects ambiguous keys', () => {
    const ref = { chapterId: 'agent', stageId: 'planning' }

    expect(makeStageKey(ref)).toBe('agent:planning')
    expect(parseStageKey('agent:planning')).toEqual(ref)
    expect(makeStageKey({ chapterId: 'rag', stageId: 'planning' })).not.toBe(makeStageKey(ref))
    expect(parseStageKey('agent:planning:extra')).toBeNull()
    expect(parseStageKey('Agent:planning')).toBeNull()
  })

  it('keeps adjacent navigation reciprocal across the registered catalog', () => {
    const flat = flattenCatalog()
    expect(flat.length).toBeGreaterThan(1)

    flat.slice(0, -1).forEach((entry, index) => {
      const current = { chapterId: entry.chapter.id, stageId: entry.stage.id }
      const nextEntry = flat[index + 1]
      const next = { chapterId: nextEntry.chapter.id, stageId: nextEntry.stage.id }

      expect(getAdjacentStage(current, 'next')).toEqual(next)
      expect(getAdjacentStage(next, 'previous')).toEqual(current)
    })

    const first = flat[0]
    const last = flat.at(-1)!
    expect(getAdjacentStage({ chapterId: first.chapter.id, stageId: first.stage.id }, 'previous')).toBeNull()
    expect(getAdjacentStage({ chapterId: last.chapter.id, stageId: last.stage.id }, 'next')).toBeNull()
  })

  it('calculates progress and first incomplete stage with namespaced keys', () => {
    const chapter = chapters[0]
    const ordered = flattenChapter(chapter)
    expect(ordered.length).toBeGreaterThan(2)
    const completed = new Set([
      makeStageKey({ chapterId: chapter.id, stageId: ordered[0].id }),
      makeStageKey({ chapterId: chapter.id, stageId: ordered[2].id }),
      makeStageKey({ chapterId: 'other-chapter', stageId: ordered[1].id }),
    ])

    expect(getChapterProgress(chapter.id, completed)).toEqual({ mastered: 2, total: ordered.length })
    expect(getFirstIncompleteStage(chapter.id, completed)).toEqual({
      chapterId: chapter.id,
      stageId: ordered[1].id,
    })
    expect(getChapterProgress('missing-chapter', completed)).toEqual({ mastered: 0, total: 0 })
    expect(getFirstIncompleteStage('missing-chapter', completed)).toBeNull()
  })
})
