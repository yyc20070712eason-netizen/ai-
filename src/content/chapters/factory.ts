import type {
  ChapterPackage,
  ChapterUnit,
  Choice,
  PracticeActivity,
  QuizQuestion,
  Stage,
  StageId,
} from '../../types'
import { CHAPTER_PREREQUISITES, chapterOrder, stageKnowledge } from '../courseTopology'

export type CourseStageSeed = {
  id: string
  unitId: string
  title: string
  durationMinutes?: number
  sourceLabel: string
  sourceHash: string
  problem: string
  outcome: string
  insight: string
  mechanism: string
  steps: [string, string, string]
  misconception: string
  decision: string
  risk: string
  concepts: [string, string, string, string]
  practice: string
  success: string
  code?: string
  codeTitle?: string
  bridge?: string
}

type CourseChapterSeed = {
  id: string
  title: string
  shortTitle: string
  order: number
  prerequisites?: string[]
  sourceId: string
  sourceTitle: string
  sourceUrl: string
  units: ChapterUnit[]
  stages: CourseStageSeed[]
  activities?: Record<StageId, PracticeActivity>
}

const choices = (...labels: string[]): Choice[] => labels.map((label, index) => ({
  id: String.fromCharCode(97 + index),
  label,
}))

function quizFor(seed: CourseStageSeed): QuizQuestion[] {
  const [first, second, third, fourth] = seed.concepts
  return [
    {
      id: `${seed.id}-scenario-decision`,
      prompt: `${seed.problem}。团队必须先做一个决定，哪项最稳妥？`,
      choices: choices('直接扩大模型和上下文，先追求看起来更聪明', seed.decision, '先写一段更长的提示词，暂不验证', '跳过边界条件，等上线后再观察'),
      answer: 'b',
      explanation: `${seed.decision}。这一步能把判断建立在可验证证据上，而不是依赖模型的自信表达。`,
      scenario: true,
      critical: true,
    },
    {
      id: `${seed.id}-scenario-risk`,
      prompt: `系统出现“${seed.risk}”。你负责排查，最有效的动作是什么？`,
      choices: choices(`先检查 ${first} 与 ${second} 的输入、输出和边界`, '立刻重写全部代码', '只看最终答案，不保留中间证据', '把失败归因于模型随机性'),
      answer: 'a',
      explanation: `先定位 ${first} 与 ${second} 的证据链，才能区分设计问题、数据问题和执行问题。`,
      scenario: true,
    },
    {
      id: `${seed.id}-scenario-review`,
      prompt: `评审时有人说：“${seed.misconception}”。你应怎样回应？`,
      choices: choices('同意，因为实现越快越重要', `要求用 ${third} 的验收标准验证这句话`, '把所有选择都交给模型', '取消记录，避免团队争论'),
      answer: 'b',
      explanation: `${seed.misconception} 是本关要避免的误区；应以 ${third} 的可观察结果判断。`,
      scenario: true,
    },
    {
      id: `${seed.id}-knowledge-core`,
      prompt: `本关中“${first}”最准确的作用是什么？`,
      choices: choices(seed.insight, '让输出文字更长', '替代所有人工判断', '保证任何任务都一次成功'),
      answer: 'a',
      explanation: seed.insight,
      scenario: false,
    },
    {
      id: `${seed.id}-knowledge-mechanism`,
      prompt: `为什么需要关注“${second}”？`,
      choices: choices('因为它只影响界面颜色', '因为它能取消所有不确定性', seed.mechanism, '因为它让测试变得不再需要'),
      answer: 'c',
      explanation: seed.mechanism,
      scenario: false,
    },
    {
      id: `${seed.id}-knowledge-order`,
      prompt: '本关推荐的处理顺序是什么？',
      choices: choices(`${seed.steps[2]} → ${seed.steps[1]} → ${seed.steps[0]}`, `${seed.steps[0]} → ${seed.steps[1]} → ${seed.steps[2]}`, '先上线 → 再定义问题 → 最后验证', '没有顺序，随机尝试即可'),
      answer: 'b',
      explanation: `先${seed.steps[0]}，再${seed.steps[1]}，最后${seed.steps[2]}，能保留清晰的因果链。`,
      scenario: false,
    },
    {
      id: `${seed.id}-knowledge-boundary`,
      prompt: `关于“${fourth}”，哪项判断正确？`,
      choices: choices('它可以被忽略，因为模型会自动处理', '它只在大型项目中有意义', '它等于把所有内容都放进上下文', `${fourth} 必须有明确输入、输出和失败处理`),
      answer: 'd',
      explanation: `明确 ${fourth} 的输入、输出和失败处理，才能让系统可测试、可恢复。`,
      scenario: false,
    },
    {
      id: `${seed.id}-knowledge-misconception`,
      prompt: '哪项最符合本关的完成标准？',
      choices: choices(seed.success, '只要示例能运行一次', '只要模型回答得很流畅', '只要代码量足够多'),
      answer: 'a',
      explanation: seed.success,
      scenario: false,
    },
  ]
}

function stageFor(chapterId: string, seed: CourseStageSeed, sourceId: string, sourceUrl: string, practiceOverride?: PracticeActivity): Stage {
  const codeLens = seed.code ? {
    title: seed.codeTitle ?? '最小可验证实现',
    code: seed.code,
    watch: [`观察 ${seed.concepts[0]} 的输入输出`, `确认 ${seed.concepts[2]} 的验收结果`],
  } : undefined

  return {
    id: seed.id,
    unitId: seed.unitId,
    title: seed.title,
    durationMinutes: seed.durationMinutes ?? 20,
    sourceRefs: [{
      sourceId,
      label: seed.sourceLabel,
      deepLink: `${sourceUrl}${seed.sourceHash}`,
    }],
    problem: seed.problem,
    outcome: seed.outcome,
    prediction: {
      prompt: `${seed.problem}。你会先怎么做？`,
      choices: choices('直接让模型给最终答案', seed.decision, '先堆更多工具再说'),
      answer: 'b',
      feedback: `${seed.decision}。先建立证据链，再扩大能力。`,
    },
    formula: `${seed.concepts[0]} + ${seed.concepts[1]} + ${seed.concepts[2]} → ${seed.concepts[3]}`,
    lesson: [
      {
        title: '先抓住核心',
        paragraphs: [seed.insight, seed.mechanism],
      },
      {
        title: '按这个顺序处理',
        paragraphs: [`常见误区：${seed.misconception}`],
        points: seed.steps,
      },
    ],
    ...(codeLens ? { codeLens } : {}),
    practice: practiceOverride ?? {
      title: `动手：${seed.title}`,
      brief: seed.practice,
      success: seed.success,
    },
    bridge: seed.bridge ?? '把这一关的判断写进笔记，再进入下一关组合能力。',
    quiz: quizFor(seed),
    knowledge: stageKnowledge(chapterId, seed.id, seed.concepts),
  }
}

export function defineCourseChapter(seed: CourseChapterSeed): ChapterPackage {
  return {
    contentSchemaVersion: 2,
    id: seed.id,
    title: seed.title,
    shortTitle: seed.shortTitle,
    order: chapterOrder(seed.id),
    ...(CHAPTER_PREREQUISITES[seed.id]?.length ? { prerequisites: CHAPTER_PREREQUISITES[seed.id] } : {}),
    sources: [{
      id: seed.sourceId,
      kind: 'remote',
      title: seed.sourceTitle,
      provider: 'feishu',
      url: seed.sourceUrl,
      embed: 'attempt',
    }],
    units: seed.units,
    stages: seed.stages.map((stage) => stageFor(seed.id, stage, seed.sourceId, seed.sourceUrl, seed.activities?.[stage.id])),
  }
}
