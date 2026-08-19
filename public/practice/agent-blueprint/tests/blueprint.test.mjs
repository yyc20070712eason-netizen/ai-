import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function text(file) {
  return readFile(new URL(file, root), 'utf8')
}

async function json(file) {
  return JSON.parse(await text(file))
}

function nonBlank(value, label) {
  assert.equal(typeof value, 'string', `${label} 必须是文本`)
  assert.ok(value.trim(), `${label} 不能为空`)
}

function hasHeading(markdown, heading) {
  assert.match(markdown, new RegExp(`^#{1,3}\\s+${heading}\\s*$`, 'mu'), `缺少标题：${heading}`)
}

function countNonBlankLabels(markdown, label) {
  return [...markdown.matchAll(new RegExp(`^${label}：\\s*(.+)$`, 'gmu'))].filter((match) => match[1].trim()).length
}

test('milestone 1 - system boundary and action contract', async () => {
  const map = await text('01-system-map.md')
  for (const heading of ['目标', '四层职责', '六步数据流', '失败点', '完成证据']) hasHeading(map, heading)
  for (const layer of ['交互层', '控制层', '能力层', '数据层']) hasHeading(map, layer)
  assert.doesNotMatch(map, /<!--/u, '请删除系统图中的模板注释并填写内容')

  const contract = await json('action-contract.json')
  nonBlank(contract.tool, 'action-contract.tool')
  nonBlank(contract.input?.orderId, 'action-contract.input.orderId')
  nonBlank(contract.reason, 'action-contract.reason')
  nonBlank(contract.fallback, 'action-contract.fallback')
  assert.ok(['order_lookup', 'refund_create', 'ask_user'].includes(contract.tool), 'tool 必须来自允许列表')
})

test('milestone 2 - verifiable plan, state, memory and tools', async () => {
  const plan = await text('02-execution-plan.md')
  assert.ok(countNonBlankLabels(plan, '输入') >= 5, '五步计划的每一步都要填写输入')
  assert.ok(countNonBlankLabels(plan, '动作') >= 5, '五步计划的每一步都要填写动作')
  assert.ok(countNonBlankLabels(plan, '可观察结果') >= 5, '五步计划的每一步都要填写可观察结果')

  const design = await json('state-and-tools.json')
  nonBlank(design.state?.currentGoal, 'state.currentGoal')
  assert.ok(Array.isArray(design.state?.constraints) && design.state.constraints.length > 0, 'state.constraints 至少需要一项')
  for (const key of ['session', 'profile', 'knowledge']) {
    assert.ok(design.memory?.[key] && typeof design.memory[key] === 'object', `memory.${key} 必须存在`)
  }
  nonBlank(design.tools?.orderLookup?.input?.orderId, 'tools.orderLookup.input.orderId')
  assert.ok(Object.keys(design.tools?.orderLookup?.success ?? {}).length > 0, 'orderLookup.success 不能为空')
  assert.ok(Object.keys(design.tools?.orderLookup?.failure ?? {}).length > 0, 'orderLookup.failure 不能为空')
})

test('milestone 3 - stop rules, routing budget and handoff', async () => {
  const reliability = await text('03-reliability.md')
  for (const heading of ['完成', '缺信息', '高风险', '预算耗尽', '不可恢复错误']) hasHeading(reliability, heading)
  for (const label of ['触发', '用户说明', '保留证据', '恢复动作']) {
    assert.ok(countNonBlankLabels(reliability, label) >= 5, `五类停止都要填写${label}`)
  }

  const routing = await json('routing-and-handoff.json')
  assert.ok(Number.isInteger(routing.budget?.maxSteps) && routing.budget.maxSteps > 0 && routing.budget.maxSteps <= 4, 'budget.maxSteps 必须为 1–4')
  assert.ok(Number.isInteger(routing.budget?.maxRetries) && routing.budget.maxRetries >= 0 && routing.budget.maxRetries <= 2, 'budget.maxRetries 必须为 0–2')
  for (const route of ['search', 'database', 'calculator']) nonBlank(routing.routes?.[route]?.for, `routes.${route}.for`)
  nonBlank(routing.multiAgentDecision?.reason, 'multiAgentDecision.reason')
  nonBlank(routing.handoff?.finalOwner, 'handoff.finalOwner')
  const requiredHandoff = ['task', 'evidence', 'confidence', 'openQuestions']
  assert.ok(Array.isArray(routing.handoff?.fields), 'handoff.fields 必须是数组')
  for (const field of requiredHandoff) assert.ok(routing.handoff.fields.includes(field), `handoff.fields 缺少 ${field}`)
})

test('milestone 4 - minimal implementation and evaluation cases', async () => {
  const implementation = await text('04-implementation.md')
  for (const heading of ['固定日报', '带审批的退款流程', '多角色内容生产']) hasHeading(implementation, heading)
  assert.ok(countNonBlankLabels(implementation, '选择') >= 3, '三个任务都要填写实现选择')
  assert.ok(countNonBlankLabels(implementation, '不用更复杂方案的理由') >= 3, '三个任务都要解释为什么不升级复杂度')

  const cases = await json('eval-cases.json')
  assert.ok(Array.isArray(cases) && cases.length >= 10, 'eval-cases.json 至少需要 10 条样本')
  const ids = new Set()
  const categories = new Set()
  for (const [index, item] of cases.entries()) {
    nonBlank(item.id, `cases[${index}].id`)
    assert.ok(!ids.has(item.id), `样本 ID 重复：${item.id}`)
    ids.add(item.id)
    nonBlank(item.category, `cases[${index}].category`)
    categories.add(item.category)
    nonBlank(item.input, `cases[${index}].input`)
    nonBlank(item.intent, `cases[${index}].intent`)
    assert.ok(item.slots && typeof item.slots === 'object' && !Array.isArray(item.slots), `cases[${index}].slots 必须是对象`)
    assert.ok(Array.isArray(item.missing), `cases[${index}].missing 必须是数组`)
    nonBlank(item.expectedAction, `cases[${index}].expectedAction`)
    nonBlank(item.expectedEvidence, `cases[${index}].expectedEvidence`)
  }
  for (const category of ['normal', 'missing-input', 'stale-data', 'tool-failure', 'unauthorized']) {
    assert.ok(categories.has(category), `缺少评测类别：${category}`)
  }
})

test('milestone 5 - complete specification, intent safety and iteration', async () => {
  const spec = await text('05-assistant-spec.md')
  for (const heading of ['支持输入', '明确不支持', '主流程', '状态与记忆', '工具与规则', '人工确认', '失败与恢复', '隐私边界', '完成证据']) {
    hasHeading(spec, heading)
  }
  assert.doesNotMatch(spec, /^##[^\n]+\n\s*(?=##|$)/gmu, '助手规格的每个二级标题都必须填写内容')

  const schema = await json('intent-schema.json')
  for (const intent of ['orderLookup', 'addressChange']) {
    assert.ok(schema.intents?.[intent], `缺少意图：${intent}`)
    assert.ok(Array.isArray(schema.intents[intent].requiredSlots) && schema.intents[intent].requiredSlots.length > 0, `${intent}.requiredSlots 不能为空`)
    nonBlank(schema.intents[intent].tool, `${intent}.tool`)
  }
  assert.ok(schema.confirmationRules?.addressChange?.required === true, 'addressChange 必须要求确认')
  assert.ok(schema.confirmationRules?.addressChange?.showBeforeAfter === true, '地址修改前必须展示新旧值')
  nonBlank(schema.fallback?.action, 'fallback.action')
  assert.ok(Array.isArray(schema.fallback?.when) && schema.fallback.when.length > 0, 'fallback.when 不能为空')

  const report = await text('iteration-report.md')
  for (const heading of ['首次运行', '最高风险失败', '根因', '最小修复', '保持不变的行为', '回归证据']) hasHeading(report, heading)
  assert.doesNotMatch(report, /^##[^\n]+\n\s*(?=##|$)/gmu, '迭代报告的每个二级标题都必须填写内容')
})
