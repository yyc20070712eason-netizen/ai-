import type {
  ConceptCheckPractice,
  PracticeActivity,
  PracticeAutoCheck,
  PracticeSubmission,
  ProjectStepPractice,
  ProjectSubmitPractice,
  StageRef,
} from '../types'

export type PracticeCheckResult = {
  id: string
  label: string
  passed: boolean
  message: string
}

export type ProjectPracticeEvaluation = {
  state: 'draft' | 'ready' | 'needs-revision' | 'meets'
  fieldsReady: boolean
  rubricReady: boolean
  evidenceReady: boolean
  checks: PracticeCheckResult[]
}

export function isConceptCheckPractice(value: PracticeActivity): value is ConceptCheckPractice {
  return 'mode' in value && value.mode === 'concept-check'
}

export function isProjectStepPractice(value: PracticeActivity): value is ProjectStepPractice {
  return 'mode' in value && value.mode === 'project-step'
}

export function isProjectSubmitPractice(value: PracticeActivity): value is ProjectSubmitPractice {
  return 'mode' in value && value.mode === 'project-submit'
}

export function rubricEvidenceKey(rubricId: string) {
  return `rubric-evidence-${rubricId}`
}

export function practiceTargetRef(current: StageRef, practice: PracticeActivity): StageRef {
  return isProjectStepPractice(practice)
    ? { chapterId: current.chapterId, stageId: practice.milestoneStageId }
    : current
}

function valueAtPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, value)
}

function hasValue(value: unknown) {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null
}

function jsonObjectCheck(check: Extract<PracticeAutoCheck, { kind: 'json-object' }>, raw: string): PracticeCheckResult {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { id: check.id, label: check.label, passed: false, message: '需要提交一个 JSON 对象。' }
    }
    const missing = check.requiredPaths.filter((path) => !hasValue(valueAtPath(parsed, path)))
    return missing.length === 0
      ? { id: check.id, label: check.label, passed: true, message: 'JSON 结构和必填字段有效。' }
      : { id: check.id, label: check.label, passed: false, message: `缺少字段：${missing.join('、')}` }
  } catch {
    return { id: check.id, label: check.label, passed: false, message: 'JSON 无法解析，请先在本机修正格式。' }
  }
}

function jsonArrayCheck(check: Extract<PracticeAutoCheck, { kind: 'json-array' }>, raw: string): PracticeCheckResult {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return { id: check.id, label: check.label, passed: false, message: '需要提交一个 JSON 数组。' }
    if (parsed.length < check.minItems) return { id: check.id, label: check.label, passed: false, message: `至少需要 ${check.minItems} 条记录。` }
    const malformed = parsed.findIndex((item) => check.itemRequiredPaths.some((path) => !hasValue(valueAtPath(item, path))))
    if (malformed >= 0) return { id: check.id, label: check.label, passed: false, message: `第 ${malformed + 1} 条记录缺少必填字段。` }
    if (check.requiredValues) {
      const actual = new Set(parsed.map((item) => String(valueAtPath(item, check.requiredValues!.path) ?? '')))
      const missing = check.requiredValues.values.filter((value) => !actual.has(value))
      if (missing.length > 0) return { id: check.id, label: check.label, passed: false, message: `还缺少类别：${missing.join('、')}` }
    }
    return { id: check.id, label: check.label, passed: true, message: `已检查 ${parsed.length} 条结构化记录。` }
  } catch {
    return { id: check.id, label: check.label, passed: false, message: 'JSON 无法解析，请先在本机修正格式。' }
  }
}

function testOutputCheck(check: Extract<PracticeAutoCheck, { kind: 'test-output' }>, raw: string): PracticeCheckResult {
  const normalized = raw.toLowerCase()
  const missing = check.requiredPhrases.filter((phrase) => !normalized.includes(phrase.toLowerCase()))
  return missing.length === 0
    ? { id: check.id, label: check.label, passed: true, message: '测试输出包含通过证据。' }
    : { id: check.id, label: check.label, passed: false, message: `测试输出还需包含：${missing.join('、')}` }
}

function runAutoCheck(check: PracticeAutoCheck, answers: Record<string, string>): PracticeCheckResult {
  const raw = answers[check.fieldId] ?? ''
  if (!raw.trim()) return { id: check.id, label: check.label, passed: false, message: '对应产物尚未填写。' }
  if (check.kind === 'json-object') return jsonObjectCheck(check, raw)
  if (check.kind === 'json-array') return jsonArrayCheck(check, raw)
  return testOutputCheck(check, raw)
}

export function evaluateProjectPractice(
  practice: ProjectSubmitPractice,
  submission?: PracticeSubmission,
): ProjectPracticeEvaluation {
  const answers = submission?.answers ?? {}
  const fieldsReady = practice.fields.every((field) => (answers[field.id] ?? '').trim().length > 0)
  const rubricReady = practice.rubric.every((item) => submission?.checkedRubricIds.includes(item.id))
  const evidenceReady = practice.rubric.every((item) => (answers[rubricEvidenceKey(item.id)] ?? '').trim().length > 0)
  const checks = practice.autoChecks.map((check) => runAutoCheck(check, answers))
  const checksReady = checks.every((check) => check.passed)

  if (!submission?.submittedAt) {
    return { state: fieldsReady && rubricReady && evidenceReady && checksReady ? 'ready' : 'draft', fieldsReady, rubricReady, evidenceReady, checks }
  }
  return {
    state: fieldsReady && rubricReady && evidenceReady && checksReady ? 'meets' : 'needs-revision',
    fieldsReady,
    rubricReady,
    evidenceReady,
    checks,
  }
}

export function practiceAllowsMastery(practice: PracticeActivity, submission?: PracticeSubmission) {
  return !isProjectSubmitPractice(practice) || evaluateProjectPractice(practice, submission).state === 'meets'
}
