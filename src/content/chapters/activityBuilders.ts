import type {
  ConceptCheckPractice,
  PracticeActivity,
  PracticeAutoCheck,
  ProjectPracticeField,
  ProjectPracticeRubric,
  ProjectSubmitPractice,
  StageId,
} from '../../types'

export type ActivityStage = { id: StageId; title: string; unitId: string }

export type MilestoneConfig = {
  stageId: StageId
  title: string
  fields: ProjectPracticeField[]
  artifactFiles: string[]
  autoChecks: PracticeAutoCheck[]
  validationCommands?: string[]
  constraints?: string[]
  given?: string[]
  rubricFocus?: string[]
}

export type ChapterActivityConfig = {
  projectName: string
  starterPackUrl: string
  context: string
  fixtures: string[]
  conceptStageIds: StageId[]
  stages: ActivityStage[]
  milestones: MilestoneConfig[]
}

export const field = (
  id: string,
  label: string,
  artifact: string,
  format: ProjectPracticeField['format'],
  prompt: string,
  placeholder: string,
): ProjectPracticeField => ({ id, label, artifact, format, prompt, placeholder })

export const jsonObjectCheck = (id: string, label: string, fieldId: string, requiredPaths: string[]): PracticeAutoCheck => ({
  id, label, fieldId, kind: 'json-object', requiredPaths,
})

export const jsonArrayCheck = (
  id: string,
  label: string,
  fieldId: string,
  minItems: number,
  itemRequiredPaths: string[],
  requiredValues?: { path: string; values: string[] },
): PracticeAutoCheck => ({ id, label, fieldId, kind: 'json-array', minItems, itemRequiredPaths, ...(requiredValues ? { requiredValues } : {}) })

export const testOutputCheck = (id: string, label: string, fieldId = 'test-output'): PracticeAutoCheck => ({
  id, label, fieldId, kind: 'test-output', requiredPhrases: ['pass', 'fail 0'],
})

function concept(config: ChapterActivityConfig, stage: ActivityStage): ConceptCheckPractice {
  return {
    mode: 'concept-check',
    title: `判断练习：${stage.title}`,
    brief: `在 ${config.projectName} 的固定情境中先做边界判断，再进入项目文件。`,
    success: '选择与本关机制一致，并能用一条可观察证据解释。',
    estimatedMinutes: 5,
    context: config.context,
    given: [config.fixtures[0], config.fixtures[1] ?? config.fixtures[0], `本关主题：${stage.title}`],
    deliverable: '选择最稳妥的下一步，并用“判断依据 + 可观察证据”写一句解释。',
    constraints: ['不能用“模型更大”代替边界判断', '不能把一次演示成功当作完整证据'],
    prompt: `面对“${stage.title}”对应的问题，哪种做法最符合本章项目规则？`,
    choices: [
      { id: 'a', label: '先扩大自动化范围，再观察是否出错' },
      { id: 'b', label: '先明确输入、边界和可检查结果，再执行最小步骤' },
      { id: 'c', label: '只记录最终答案，不保留过程证据' },
    ],
    answer: 'b',
    feedback: '项目实践先收紧输入、边界和验收，再逐步扩大能力；这样才能区分做过与做对。',
  }
}

function rubricFor(milestone: MilestoneConfig): ProjectPracticeRubric[] {
  const focuses = milestone.rubricFocus ?? ['结构完整', '边界明确', '证据可复查']
  return focuses.slice(0, 4).map((focus, index) => ({
    id: `evidence-${index + 1}`,
    label: focus,
    criterion: `${focus}必须能从本里程碑的文件或测试输出中直接核对。`,
    evidencePrompt: `指出支持“${focus}”的字段、段落或测试名称。`,
    ...(index === 0 || index === focuses.length - 1 ? { critical: true } : {}),
  }))
}

function submit(config: ChapterActivityConfig, milestone: MilestoneConfig): ProjectSubmitPractice {
  const testField = milestone.fields.find((item) => item.format === 'test-output')
  return {
    mode: 'project-submit',
    title: milestone.title,
    brief: `把本单元草稿整理为 ${config.projectName} 的可复用阶段成果，并用确定性检查验证。`,
    success: '所有必填结构可解析、关键量表有具体依据，声明的测试结果为零失败。',
    estimatedMinutes: 20,
    context: config.context,
    given: milestone.given ?? [...config.fixtures, '本单元前置关卡保存的项目草稿'],
    deliverable: `完成 ${milestone.artifactFiles.join('、')}，运行验证命令并提交对应字段。`,
    constraints: milestone.constraints ?? ['只使用虚拟资料', '不得写入 API Key、Cookie 或真实个人信息', '不得删除失败样本来换取通过'],
    milestoneId: `${milestone.stageId}-milestone`,
    starterPackUrl: config.starterPackUrl,
    artifactFiles: milestone.artifactFiles,
    validationCommands: milestone.validationCommands ?? ['npm test'],
    fields: milestone.fields,
    rubric: rubricFor(milestone),
    autoChecks: milestone.autoChecks,
    hints: ['先让 JSON 和最小测试通过，再补开放式说明。', '量表依据必须引用具体字段、标题或测试名称。'],
    reference: {
      outline: milestone.fields.map((item) => `${item.artifact}：${item.label}`),
      exampleAnswers: Object.fromEntries(milestone.fields.map((item) => [item.id, item.placeholder])),
      commonMistakes: ['只写结论，没有输入、边界或失败路径。', testField ? '粘贴了命令但没有真实测试摘要。' : 'JSON 字段存在，但值为空或无法执行。'],
    },
  }
}

export function createChapterActivities(config: ChapterActivityConfig): Record<StageId, PracticeActivity> {
  const milestones = new Map(config.milestones.map((item) => [item.stageId, item]))
  const activities: Record<StageId, PracticeActivity> = {}

  for (const stage of config.stages) {
    const milestone = milestones.get(stage.id)
    if (milestone) {
      activities[stage.id] = submit(config, milestone)
      continue
    }
    if (config.conceptStageIds.includes(stage.id)) {
      activities[stage.id] = concept(config, stage)
      continue
    }
    const stageIndex = config.stages.indexOf(stage)
    const target = config.stages.slice(stageIndex + 1).find((candidate) => candidate.unitId === stage.unitId && milestones.has(candidate.id))
    if (!target) throw new Error(`${stage.id} 缺少同单元后续里程碑`)
    const targetMilestone = milestones.get(target.id)!
    const fieldIndex = config.stages.filter((candidate) => candidate.unitId === stage.unitId).indexOf(stage) % targetMilestone.fields.length
    const selectedField = targetMilestone.fields[fieldIndex]
    activities[stage.id] = {
      mode: 'project-step',
      title: `项目草稿：${stage.title}`,
      brief: `围绕“${stage.title}”补充 ${selectedField.artifact}，草稿会保存到后续正式里程碑。`,
      success: `草稿包含本关输入、明确动作和至少一个可检查结果，并与 ${selectedField.label} 的格式一致。`,
      estimatedMinutes: 9,
      context: config.context,
      given: [...config.fixtures.slice(0, 2), `目标文件：${selectedField.artifact}`],
      deliverable: selectedField.prompt,
      constraints: ['只修改目标里程碑声明的字段', '必须保留失败、缺参或边界情况', '只使用起始包中的虚拟材料'],
      milestoneStageId: target.id,
      milestoneTitle: targetMilestone.title,
      starterPackUrl: config.starterPackUrl,
      fields: [selectedField],
    }
  }
  return activities
}
