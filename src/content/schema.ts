import { isConceptCheckPractice, isProjectStepPractice, isProjectSubmitPractice } from '../lib/practice'
import type {
  ChapterPackage,
  PracticeFrame,
  ProjectPracticeField,
  ProjectSubmitPractice,
  QuizQuestion,
  StageKnowledge,
  StageRef,
  StageKey,
} from '../types'

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function makeStageKey(ref: StageRef): StageKey {
  return `${ref.chapterId}:${ref.stageId}`
}

export function parseStageKey(key: string): StageRef | null {
  const parts = key.split(':')
  if (parts.length !== 2 || !parts.every((part) => ID_PATTERN.test(part))) return null
  return { chapterId: parts[0], stageId: parts[1] }
}

function assertText(value: unknown, path: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} 必须是非空文本`)
  }
}

function assertUnique(values: string[], path: string) {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${path} 存在重复 ID：${value}`)
    seen.add(value)
  }
}

function normalizeChoiceLabel(label: string) {
  return label.replace(/\s+/gu, '')
}

function validateChoices(choices: QuizQuestion['choices'], answer: string, path: string) {
  if (choices.length < 2) throw new Error(`${path} 至少需要两个选项`)
  assertUnique(choices.map((choice) => choice.id), path)
  choices.forEach((choice, index) => assertText(choice.label, `${path}[${index}].label`))

  const normalizedLabels = choices.map((choice) => normalizeChoiceLabel(choice.label))
  if (new Set(normalizedLabels).size !== normalizedLabels.length) {
    throw new Error(`${path} 存在重复选项文本`)
  }
  if (!choices.some((choice) => choice.id === answer)) {
    throw new Error(`${path.replace(/\.choices$/u, '.answer')} 未指向有效选项`)
  }
}

function validateQuestion(question: QuizQuestion, path: string) {
  assertText(question.id, `${path}.id`)
  assertText(question.prompt, `${path}.prompt`)
  assertText(question.explanation, `${path}.explanation`)
  validateChoices(question.choices, question.answer, `${path}.choices`)
}

function validateKnowledge(knowledge: StageKnowledge, path: string) {
  if (!['recognize', 'understand', 'apply', 'transfer', 'master'].includes(knowledge.depth)) {
    throw new Error(`${path}.depth 无效`)
  }
  if (knowledge.keyConcepts.length === 0) throw new Error(`${path}.keyConcepts 至少需要一个概念`)
  knowledge.keyConcepts.forEach((concept, index) => assertText(concept, `${path}.keyConcepts[${index}]`))
  assertUnique(knowledge.keyConcepts, `${path}.keyConcepts`)
  if (knowledge.prerequisites.length > 3) throw new Error(`${path}.prerequisites 最多三个直接前置`)
}

function validatePracticeFrame(practice: PracticeFrame, path: string) {
  assertText(practice.brief, `${path}.brief`)
  assertText(practice.success, `${path}.success`)
  assertText(practice.context, `${path}.context`)
  assertText(practice.deliverable, `${path}.deliverable`)
  if (!Number.isFinite(practice.estimatedMinutes) || practice.estimatedMinutes < 3 || practice.estimatedMinutes > 60) {
    throw new Error(`${path}.estimatedMinutes 必须在 3–60 分钟之间`)
  }
  if (practice.given.length === 0 || practice.constraints.length === 0) throw new Error(`${path} 的给定材料和限制条件不能为空`)
  practice.given.forEach((item, index) => assertText(item, `${path}.given[${index}]`))
  practice.constraints.forEach((item, index) => assertText(item, `${path}.constraints[${index}]`))
}

function validateProjectFields(fields: ProjectPracticeField[], path: string) {
  if (fields.length === 0 || fields.length > 6) throw new Error(`${path} 必须为 1–6 项`)
  assertUnique(fields.map((item) => item.id), path)
  fields.forEach((item, index) => {
    const fieldPath = `${path}[${index}](${item.id})`
    if (!ID_PATTERN.test(item.id)) throw new Error(`${fieldPath}.id 必须使用 kebab-case`)
    assertText(item.label, `${fieldPath}.label`)
    assertText(item.prompt, `${fieldPath}.prompt`)
    assertText(item.placeholder, `${fieldPath}.placeholder`)
    assertText(item.artifact, `${fieldPath}.artifact`)
    if (!['markdown', 'json', 'test-output'].includes(item.format)) throw new Error(`${fieldPath}.format 无效`)
  })
}

function validateSubmitPractice(practice: ProjectSubmitPractice, path: string) {
  validateProjectFields(practice.fields, `${path}.fields`)
  if (!ID_PATTERN.test(practice.milestoneId)) throw new Error(`${path}.milestoneId 必须使用 kebab-case`)
  if (!practice.starterPackUrl.startsWith('/practice/') || !practice.starterPackUrl.endsWith('.zip')) throw new Error(`${path}.starterPackUrl 必须指向 practice 下的 ZIP`)
  if (practice.artifactFiles.length === 0 || practice.validationCommands.length === 0) throw new Error(`${path} 必须声明产物文件和验证命令`)
  assertUnique(practice.artifactFiles, `${path}.artifactFiles`)
  practice.artifactFiles.forEach((item, index) => assertText(item, `${path}.artifactFiles[${index}]`))
  practice.validationCommands.forEach((item, index) => assertText(item, `${path}.validationCommands[${index}]`))
  if (practice.rubric.length < 3 || practice.rubric.length > 5) throw new Error(`${path}.rubric 必须为 3–5 项`)
  assertUnique(practice.rubric.map((item) => item.id), `${path}.rubric`)
  practice.rubric.forEach((item, index) => {
    const rubricPath = `${path}.rubric[${index}](${item.id})`
    if (!ID_PATTERN.test(item.id)) throw new Error(`${rubricPath}.id 必须使用 kebab-case`)
    assertText(item.label, `${rubricPath}.label`)
    assertText(item.criterion, `${rubricPath}.criterion`)
    assertText(item.evidencePrompt, `${rubricPath}.evidencePrompt`)
  })
  if (!practice.rubric.some((item) => item.critical)) throw new Error(`${path}.rubric 至少需要一个关键量表`)
  if (practice.autoChecks.length === 0) throw new Error(`${path}.autoChecks 不能为空`)
  assertUnique(practice.autoChecks.map((item) => item.id), `${path}.autoChecks`)
  const fieldById = new Map(practice.fields.map((item) => [item.id, item]))
  practice.autoChecks.forEach((check, index) => {
    const checkPath = `${path}.autoChecks[${index}](${check.id})`
    if (!ID_PATTERN.test(check.id)) throw new Error(`${checkPath}.id 必须使用 kebab-case`)
    assertText(check.label, `${checkPath}.label`)
    const field = fieldById.get(check.fieldId)
    if (!field) throw new Error(`${checkPath}.fieldId 引用了不存在的字段 ${check.fieldId}`)
    if (check.kind === 'test-output') {
      if (field.format !== 'test-output') throw new Error(`${checkPath} 必须引用 test-output 字段`)
      if (check.requiredPhrases.length === 0) throw new Error(`${checkPath}.requiredPhrases 不能为空`)
      check.requiredPhrases.forEach((item, phraseIndex) => assertText(item, `${checkPath}.requiredPhrases[${phraseIndex}]`))
    } else {
      if (field.format !== 'json') throw new Error(`${checkPath} 必须引用 JSON 字段`)
      const paths = check.kind === 'json-object' ? check.requiredPaths : check.itemRequiredPaths
      if (paths.length === 0) throw new Error(`${checkPath} 必须声明必填路径`)
      paths.forEach((item, pathIndex) => assertText(item, `${checkPath}.paths[${pathIndex}]`))
      if (check.kind === 'json-array') {
        if (!Number.isInteger(check.minItems) || check.minItems < 1) throw new Error(`${checkPath}.minItems 无效`)
        check.requiredValues?.values.forEach((item, valueIndex) => assertText(item, `${checkPath}.requiredValues.values[${valueIndex}]`))
      }
    }
  })
  if (practice.hints.length !== 2 || practice.reference.outline.length !== practice.fields.length || practice.reference.commonMistakes.length < 2) {
    throw new Error(`${path} 的提示或参考结构不完整`)
  }
  practice.hints.forEach((item, index) => assertText(item, `${path}.hints[${index}]`))
  practice.reference.outline.forEach((item, index) => assertText(item, `${path}.reference.outline[${index}]`))
  practice.fields.forEach((field) => assertText(practice.reference.exampleAnswers[field.id], `${path}.reference.exampleAnswers.${field.id}`))
  practice.reference.commonMistakes.forEach((item, index) => assertText(item, `${path}.reference.commonMistakes[${index}]`))
}

export function validateCatalog(chapters: ChapterPackage[]): ChapterPackage[] {
  if (chapters.length === 0) throw new Error('课程目录至少需要一个章节')
  assertUnique(chapters.map((chapter) => chapter.id), 'chapters')
  const chapterIds = new Set(chapters.map((chapter) => chapter.id))

  chapters.forEach((chapter, chapterIndex) => {
    const path = `chapters[${chapterIndex}](${chapter.id})`
    if (chapter.contentSchemaVersion !== 1 && chapter.contentSchemaVersion !== 2) throw new Error(`${path} 的内容版本不受支持`)
    if (!ID_PATTERN.test(chapter.id)) throw new Error(`${path}.id 必须使用 kebab-case`)
    assertText(chapter.title, `${path}.title`)
    assertText(chapter.shortTitle, `${path}.shortTitle`)
    if (!Number.isFinite(chapter.order)) throw new Error(`${path}.order 必须是数字`)
    chapter.prerequisites?.forEach((id) => {
      if (!chapterIds.has(id)) throw new Error(`${path}.prerequisites 引用了不存在的章节 ${id}`)
      if (id === chapter.id) throw new Error(`${path} 不能依赖自身`)
    })

    assertUnique(chapter.sources.map((source) => source.id), `${path}.sources`)
    const sourceIds = new Set(chapter.sources.map((source) => source.id))
    chapter.sources.forEach((source, sourceIndex) => {
      const sourcePath = `${path}.sources[${sourceIndex}]`
      if (!ID_PATTERN.test(source.id)) throw new Error(`${sourcePath}.id 必须使用 kebab-case`)
      assertText(source.title, `${sourcePath}.title`)
      const url = source.kind === 'remote' ? source.url : source.assetUrl
      if (source.kind === 'remote' && !url.startsWith('https://')) throw new Error(`${sourcePath} 必须使用 HTTPS`)
      assertText(url, `${sourcePath}.url`)
    })

    assertUnique(chapter.units.map((unit) => unit.id), `${path}.units`)
    assertUnique(chapter.stages.map((stage) => stage.id), `${path}.stages`)
    const stageIds = new Set(chapter.stages.map((stage) => stage.id))
    const assigned = new Map<string, number>()

    chapter.units.forEach((unit, unitIndex) => {
      const unitPath = `${path}.units[${unitIndex}]`
      if (!ID_PATTERN.test(unit.id)) throw new Error(`${unitPath}.id 必须使用 kebab-case`)
      assertText(unit.title, `${unitPath}.title`)
      if (unit.stageIds.length === 0) throw new Error(`${unitPath} 至少需要一个关卡`)
      assertUnique(unit.stageIds, `${unitPath}.stageIds`)
      unit.stageIds.forEach((stageId) => {
        if (!stageIds.has(stageId)) throw new Error(`${unitPath} 引用了不存在的关卡 ${stageId}`)
        assigned.set(stageId, (assigned.get(stageId) ?? 0) + 1)
      })
    })

    chapter.stages.forEach((stage, stageIndex) => {
      const stagePath = `${path}.stages[${stageIndex}](${stage.id})`
      if (!ID_PATTERN.test(stage.id)) throw new Error(`${stagePath}.id 必须使用 kebab-case`)
      if (!chapter.units.some((unit) => unit.id === stage.unitId)) throw new Error(`${stagePath}.unitId 无效`)
      if (assigned.get(stage.id) !== 1) throw new Error(`${stagePath} 必须恰好出现在一个单元中`)
      assertText(stage.title, `${stagePath}.title`)
      assertText(stage.problem, `${stagePath}.problem`)
      assertText(stage.outcome, `${stagePath}.outcome`)
      if (chapter.contentSchemaVersion === 2 && !stage.knowledge) throw new Error(`${stagePath}.knowledge 是内容版本 2 的必填字段`)
      if (stage.knowledge) validateKnowledge(stage.knowledge, `${stagePath}.knowledge`)
      assertText(stage.prediction.prompt, `${stagePath}.prediction.prompt`)
      assertText(stage.prediction.feedback, `${stagePath}.prediction.feedback`)
      validateChoices(stage.prediction.choices, stage.prediction.answer, `${stagePath}.prediction.choices`)
      assertText(stage.practice.title, `${stagePath}.practice.title`)
      assertText(stage.practice.brief, `${stagePath}.practice.brief`)
      assertText(stage.practice.success, `${stagePath}.practice.success`)
      if (isConceptCheckPractice(stage.practice)) {
        validatePracticeFrame(stage.practice, `${stagePath}.practice`)
        assertText(stage.practice.prompt, `${stagePath}.practice.prompt`)
        assertText(stage.practice.feedback, `${stagePath}.practice.feedback`)
        validateChoices(stage.practice.choices, stage.practice.answer, `${stagePath}.practice.choices`)
      } else if (isProjectStepPractice(stage.practice)) {
        validatePracticeFrame(stage.practice, `${stagePath}.practice`)
        validateProjectFields(stage.practice.fields, `${stagePath}.practice.fields`)
        assertText(stage.practice.milestoneTitle, `${stagePath}.practice.milestoneTitle`)
        if (!stage.practice.starterPackUrl.startsWith('/practice/') || !stage.practice.starterPackUrl.endsWith('.zip')) throw new Error(`${stagePath}.practice.starterPackUrl 无效`)
        const milestoneStageId = stage.practice.milestoneStageId
        const target = chapter.stages.find((item) => item.id === milestoneStageId)
        if (!target || !isProjectSubmitPractice(target.practice)) throw new Error(`${stagePath}.practice.milestoneStageId 必须指向正式提交关`)
        if (target.unitId !== stage.unitId || chapter.stages.indexOf(target) <= stageIndex) throw new Error(`${stagePath}.practice.milestoneStageId 必须指向同单元后续关卡`)
        const targetFieldIds = new Set(target.practice.fields.map((item) => item.id))
        stage.practice.fields.forEach((field) => {
          if (!targetFieldIds.has(field.id)) throw new Error(`${stagePath}.practice.fields.${field.id} 未在目标里程碑中定义`)
        })
      } else if (isProjectSubmitPractice(stage.practice)) {
        validatePracticeFrame(stage.practice, `${stagePath}.practice`)
        validateSubmitPractice(stage.practice, `${stagePath}.practice`)
      }
      assertText(stage.bridge, `${stagePath}.bridge`)
      if (!Number.isFinite(stage.durationMinutes) || stage.durationMinutes < 5 || stage.durationMinutes > 120) {
        throw new Error(`${stagePath}.durationMinutes 必须在 5–120 分钟之间`)
      }
      if (stage.sourceRefs.length === 0) throw new Error(`${stagePath} 至少需要一个原文引用`)
      stage.sourceRefs.forEach((ref) => {
        if (!sourceIds.has(ref.sourceId)) throw new Error(`${stagePath} 引用了不存在的来源 ${ref.sourceId}`)
        assertText(ref.label, `${stagePath}.sourceRefs.label`)
      })
      if (stage.quiz.length < 8) throw new Error(`${stagePath}.quiz 至少需要 8 题`)
      if (stage.quiz.filter((question) => question.scenario).length < 3) throw new Error(`${stagePath}.quiz 至少需要 3 道场景题`)
      if (!stage.quiz.some((question) => question.scenario && question.critical)) throw new Error(`${stagePath}.quiz 至少需要 1 道关键场景题`)
      assertUnique(stage.quiz.map((question) => question.id), `${stagePath}.quiz`)
      stage.quiz.forEach((question, questionIndex) => validateQuestion(question, `${stagePath}.quiz[${questionIndex}]`))
    })
  })

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`章节依赖存在循环：${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    const chapter = chapters.find((item) => item.id === id)
    chapter?.prerequisites?.forEach(visit)
    visiting.delete(id)
    visited.add(id)
  }
  chapters.forEach((chapter) => visit(chapter.id))

  const stageByKey = new Map<string, { chapter: ChapterPackage; stageIndex: number }>()
  chapters.forEach((chapter) => chapter.stages.forEach((stage, stageIndex) => {
    stageByKey.set(makeStageKey({ chapterId: chapter.id, stageId: stage.id }), { chapter, stageIndex })
  }))
  const prerequisiteEdges = new Map<string, Set<string>>()
  chapters.forEach((chapter) => chapter.stages.forEach((stage) => {
    if (!stage.knowledge) return
    const key = makeStageKey({ chapterId: chapter.id, stageId: stage.id })
    const direct = new Set<string>()
    stage.knowledge.prerequisites.forEach((ref, index) => {
      const prerequisiteKey = makeStageKey(ref)
      if (!stageByKey.has(prerequisiteKey)) throw new Error(`${key}.knowledge.prerequisites[${index}] 引用了不存在的关卡`)
      if (prerequisiteKey === key) throw new Error(`${key}.knowledge.prerequisites 不能依赖自身`)
      if (direct.has(prerequisiteKey)) throw new Error(`${key}.knowledge.prerequisites 存在重复前置`)
      direct.add(prerequisiteKey)
    })
    prerequisiteEdges.set(key, direct)
  }))

  const visitingStages = new Set<string>()
  const visitedStages = new Set<string>()
  const visitStage = (key: string) => {
    if (visitingStages.has(key)) throw new Error(`关卡前置依赖存在循环：${key}`)
    if (visitedStages.has(key)) return
    visitingStages.add(key)
    prerequisiteEdges.get(key)?.forEach(visitStage)
    visitingStages.delete(key)
    visitedStages.add(key)
  }
  prerequisiteEdges.forEach((_value, key) => visitStage(key))
  const reaches = (from: string, target: string, seen = new Set<string>()): boolean => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    return [...(prerequisiteEdges.get(from) ?? [])].some((next) => reaches(next, target, seen))
  }
  prerequisiteEdges.forEach((direct, key) => {
    const prerequisites = [...direct]
    prerequisites.forEach((candidate) => {
      if (prerequisites.some((other) => other !== candidate && reaches(other, candidate))) {
        throw new Error(`${key}.knowledge.prerequisites 包含冗余传递前置 ${candidate}`)
      }
    })
  })
  return chapters
}
