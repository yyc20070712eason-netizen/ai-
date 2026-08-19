import type {
  ConceptCheckPractice,
  PracticeActivity,
  ProjectPracticeField,
  ProjectPracticeRubric,
  ProjectStepPractice,
  ProjectSubmitPractice,
  StageId,
} from '../../../types'

const starterPackUrl = '/practice/agent-blueprint-starter.zip'
const context = '你正在为个人学习项目设计一个“订单查询与退款助手”。它只能处理虚拟订单，不连接真实商家、支付或用户数据。'

const field = (
  id: string,
  label: string,
  artifact: string,
  format: ProjectPracticeField['format'],
  prompt: string,
  placeholder: string,
): ProjectPracticeField => ({ id, label, artifact, format, prompt, placeholder })

const rubric = (
  id: string,
  label: string,
  criterion: string,
  evidencePrompt: string,
  critical = false,
): ProjectPracticeRubric => ({ id, label, criterion, evidencePrompt, ...(critical ? { critical: true } : {}) })

function concept(input: Omit<ConceptCheckPractice, 'mode' | 'context'>): ConceptCheckPractice {
  return { mode: 'concept-check', context, ...input }
}

function step(input: Omit<ProjectStepPractice, 'mode' | 'context' | 'starterPackUrl'>): ProjectStepPractice {
  return { mode: 'project-step', context, starterPackUrl, ...input }
}

function submit(input: Omit<ProjectSubmitPractice, 'mode' | 'context' | 'starterPackUrl'>): ProjectSubmitPractice {
  return { mode: 'project-submit', context, starterPackUrl, ...input }
}

const executionPlan = field(
  'execution-plan',
  '可验证执行计划',
  '02-execution-plan.md',
  'markdown',
  '在本机文件中写 5 个步骤。每步必须使用“输入 → 动作 → 可观察结果”格式，并包含口径确认、数据检查和最终验证。',
  '## 1. 确认目标与口径\n输入：……\n动作：……\n可观察结果：……',
)

const stateAndTools = field(
  'state-and-tools',
  '状态、记忆与工具合同',
  'state-and-tools.json',
  'json',
  '维护一个 JSON 对象：state 保存当前目标和约束；memory 区分 session、profile、knowledge；tools.orderLookup 写明输入、成功、失败和副作用。',
  '{\n  "state": { "currentGoal": "", "constraints": [] },\n  "memory": { "session": {}, "profile": {}, "knowledge": {} },\n  "tools": { "orderLookup": { "input": { "orderId": "" }, "success": {}, "failure": {} } }\n}',
)

const reliability = field(
  'reliability',
  '停止、重试与恢复规则',
  '03-reliability.md',
  'markdown',
  '分别写出完成、缺信息、高风险、预算耗尽、不可恢复错误五类停止条件；每类都写用户说明、保留证据和恢复动作。',
  '## 缺信息\n触发：缺少 orderId\n用户说明：……\n保留证据：……\n恢复动作：……',
)

const routingAndHandoff = field(
  'routing-and-handoff',
  '工具路由、预算与交接',
  'routing-and-handoff.json',
  'json',
  '用 JSON 写出 maxSteps、搜索/数据库/计算器三类路由，以及是否拆多角色；若拆分，必须有唯一 finalOwner 和结构化 handoff.fields。',
  '{\n  "budget": { "maxSteps": 4 },\n  "routes": { "search": {}, "database": {}, "calculator": {} },\n  "handoff": { "finalOwner": "", "fields": [] }\n}',
)

const implementation = field(
  'implementation-choice',
  '最小实现选择',
  '04-implementation.md',
  'markdown',
  '分别为固定日报、带审批退款和多角色内容生产选择脚本、普通工作流、单 Agent 或多 Agent，并写出不用更复杂方案的理由。',
  '## 固定日报\n选择：……\n不用更复杂方案的理由：……',
)

const evalCases = field(
  'eval-cases',
  '评测与意图样本',
  'eval-cases.json',
  'json',
  '创建至少 10 条 JSON 记录。每条包含 id、category、input、expectedAction、expectedEvidence，并补充 intent、slots、missing；必须覆盖五个指定类别。',
  '[\n  {\n    "id": "case-01",\n    "category": "normal",\n    "input": "查订单 A100",\n    "intent": "orderLookup",\n    "slots": { "orderId": "A100" },\n    "missing": [],\n    "expectedAction": "lookup",\n    "expectedEvidence": "返回订单更新时间"\n  }\n]',
)

const intentSchema = field(
  'intent-schema',
  '多意图与确认合同',
  'intent-schema.json',
  'json',
  '定义 orderLookup 和 addressChange 两个意图的必填槽位、依赖顺序、修改地址前确认规则，以及低置信或未知输入的 fallback。',
  '{\n  "intents": { "orderLookup": {}, "addressChange": {} },\n  "confirmationRules": { "addressChange": {} },\n  "fallback": {}\n}',
)

const assistantSpec = field(
  'assistant-spec',
  '完整助手规格',
  '05-assistant-spec.md',
  'markdown',
  '写清支持输入、明确不支持项、主流程、状态、工具、失败分支、人工确认、隐私边界和可观察完成证据。',
  '# 订单查询与退款助手\n## 支持输入\n……\n## 主流程\n……\n## 失败与确认\n……',
)

const iterationReport = field(
  'iteration-report',
  '第一次迭代报告',
  'iteration-report.md',
  'markdown',
  '记录运行了哪些样本、最高风险失败、最小修复、保持不变的行为，以及修复后的回归结果。',
  '## 本轮失败\n……\n## 最小修复\n……\n## 回归证据\n……',
)

const testOutput = field(
  'test-output',
  '本机测试输出',
  '终端输出',
  'test-output',
  '在起始包目录运行 npm test，将包含 pass 和 fail 0 的完整摘要粘贴到这里。不要伪造未运行的结果。',
  '# tests 5\n# pass 5\n# fail 0',
)

export const agentActivities: Record<StageId, PracticeActivity> = {
  'what-is-agent': concept({
    title: '先判断：哪一个才是 Agent', brief: '不要先写长答案。用行动和完成证据判断产品是否真的在替用户推进任务。', success: '能指出 Agent 必须观察环境、执行动作，并返回可核验结果。', estimatedMinutes: 4,
    given: ['产品 A：根据 FAQ 生成一段退款说明', '产品 B：每天固定时间发送同一份报表', '产品 C：读取订单、检查退款资格、等待确认后创建虚拟退款单'],
    deliverable: '选出最符合 Agent 的产品，并用“观察—行动—证据”解释。', constraints: ['不能把文字更长当作行动', '不能把固定定时任务自动等同于 Agent'],
    prompt: '哪一个产品最符合本章对 Agent 的定义？',
    choices: [{ id: 'a', label: '产品 A' }, { id: 'b', label: '产品 B' }, { id: 'c', label: '产品 C' }], answer: 'c',
    feedback: '产品 C 会读取外部状态、执行受约束动作，并用退款单状态证明结果；这三点构成执行闭环。',
  }),
  'four-layer-architecture': concept({
    title: '把一次订单查询放回正确层次', brief: '同一故障必须先定位到层次，才知道该修界面、控制、工具还是数据。', success: '能区分四层职责，并把重复调用定位到控制层的状态或停止条件。', estimatedMinutes: 5,
    given: ['用户已提供订单号', '订单工具正确返回 delivered', '系统仍连续调用订单工具'],
    deliverable: '选择首要排查层，并说明正常数据应如何流回下一轮判断。', constraints: ['不能用“换更大模型”代替故障定位', '必须说明工具结果写回哪里'],
    prompt: '订单工具已经成功，系统却继续重复查询，首要排查哪里？',
    choices: [{ id: 'a', label: '交互层的输入框样式' }, { id: 'b', label: '控制层的状态写回与停止分支' }, { id: 'c', label: '数据层更换数据库品牌' }], answer: 'b',
    feedback: '工具结果必须写回状态，控制层再据此选择完成、重试、追问或转人工。',
  }),
  'model-boundaries': submit({
    title: '里程碑 1：画清 Agent 系统边界', brief: '把前三关合成一张可交给开发者检查的系统图和动作合同。', success: '行动、四层数据流、模型/工具/规则边界和完成证据均可核查。', estimatedMinutes: 15,
    given: ['用户输入：“帮我查订单 A100，如果符合条件就申请退款”', '虚拟工具只有 order_lookup、refund_create、ask_user', '退款创建前必须展示金额并等待确认'],
    deliverable: '完成 01-system-map.md 和 action-contract.json，并运行里程碑 1 测试。', constraints: ['不连接真实 API', '模型不得编造订单状态', '退款动作必须有人工确认'],
    milestoneId: 'milestone-1', artifactFiles: ['01-system-map.md', 'action-contract.json'], validationCommands: ['node --test --test-name-pattern="milestone 1"'],
    fields: [
      field('system-map', '系统边界图', '01-system-map.md', 'markdown', '按“目标、四层职责、六步数据流、失败点、完成证据”五个标题填写。', '# 目标\n……\n## 四层职责\n……\n## 六步数据流\n……'),
      field('action-contract', '动作合同', 'action-contract.json', 'json', '粘贴合法 JSON，至少包含 tool、input.orderId、reason 和 fallback。', '{\n  "tool": "order_lookup",\n  "input": { "orderId": "A100" },\n  "reason": "",\n  "fallback": "ask_user"\n}'),
    ],
    rubric: [
      rubric('closed-loop', '形成执行闭环', '目标包含读取、行动和完成证据，而不只是生成回答。', '指出 01-system-map.md 中对应的目标与完成证据段落。', true),
      rubric('four-layers', '四层职责清楚', '交互、控制、能力、数据层没有相互冒充。', '列出四层标题，并指出一次工具结果写回的位置。'),
      rubric('fact-boundary', '实时事实不靠猜', '订单状态来自工具，规则负责权限与确认。', '指出 action-contract.json 中的工具字段及系统图中的确认规则。', true),
    ],
    autoChecks: [{ id: 'action-json', label: '动作合同 JSON', fieldId: 'action-contract', kind: 'json-object', requiredPaths: ['tool', 'input.orderId', 'reason', 'fallback'] }],
    hints: ['先画“用户—控制—模型—工具—状态—用户”六个节点。', '如果一个字段会改变现实，就把权限与确认放在模型之外。'],
    reference: { outline: ['系统边界与数据流', '结构化动作合同'], exampleAnswers: { 'system-map': '目标明确包含查单与经确认后申请退款；控制层保存工具结果并判断终态。', 'action-contract': '{ "tool": "order_lookup", "input": { "orderId": "A100" }, "reason": "读取实时订单状态", "fallback": "ask_user" }' }, commonMistakes: ['把模型当成订单数据库。', '退款创建没有确认点或完成证据。'] },
  }),
  planning: step({
    title: '项目草稿：写出可验证计划', brief: '先完成执行计划部分，后续记忆与工具合同会继续写入同一里程碑。', success: '每一步都有输入、动作和可观察结果。', estimatedMinutes: 8,
    given: ['目标：查订单并在符合条件时准备退款', '订单号可能缺失', '工具可能返回暂时错误'], deliverable: '完成 02-execution-plan.md 的五步计划。', constraints: ['先确认口径再行动', '至少安排一次数据检查和一次结论验证'],
    milestoneStageId: 'tools-and-react', milestoneTitle: '里程碑 2：让 Agent 可执行', fields: [executionPlan],
  }),
  memory: step({
    title: '项目草稿：给状态和记忆定生命周期', brief: '把会变化的任务状态、稳定偏好和带版本的业务知识分开。', success: '每类信息都有来源、写入时机和过期或删除规则。', estimatedMinutes: 8,
    given: ['本次订单号和预算', '用户长期语言偏好', '退款政策版本', '刚查询到的订单状态'], deliverable: '在 state-and-tools.json 中完成 state 和 memory，tools 可暂留模板。', constraints: ['不得保存 API Key', '订单状态必须带查询时间', '用户可以修改或删除长期偏好'],
    milestoneStageId: 'tools-and-react', milestoneTitle: '里程碑 2：让 Agent 可执行', fields: [stateAndTools],
  }),
  'tools-and-react': submit({
    title: '里程碑 2：让 Agent 可执行', brief: '把计划、状态、记忆和工具合同接成一个可检查的执行设计。', success: '计划可执行，信息生命周期清楚，工具成功与失败均有结构化合同。', estimatedMinutes: 18,
    given: ['前两关已保存的执行计划和记忆草稿', 'order_lookup 是只读工具', 'refund_create 是有副作用的虚拟工具'], deliverable: '补齐 02-execution-plan.md 和 state-and-tools.json，并运行里程碑 2 测试。', constraints: ['每轮最多一个工具动作', '缺订单号必须追问', '真实退款永远不执行'],
    milestoneId: 'milestone-2', artifactFiles: ['02-execution-plan.md', 'state-and-tools.json'], validationCommands: ['node --test --test-name-pattern="milestone 2"'], fields: [executionPlan, stateAndTools],
    rubric: [
      rubric('verifiable-plan', '计划可验证', '五步计划均有输入、动作和可观察结果。', '指出计划中数据检查和结论验证分别位于哪一步。', true),
      rubric('memory-lifecycle', '记忆有生命周期', 'session、profile、knowledge 的来源和过期方式不同。', '指出 JSON 中三类记忆字段及其清理规则。'),
      rubric('tool-contract', '工具合同完整', '输入、成功、失败和副作用足以让控制层可靠处理。', '指出 orderLookup 的输入和失败字段。', true),
      rubric('react-observation', '观察改变下一步', '工具为空或失败时会追问、重试或停止，而不是继续编造。', '指出计划或 JSON 中处理空结果的位置。'),
    ],
    autoChecks: [{ id: 'state-tools-json', label: '状态与工具 JSON', fieldId: 'state-and-tools', kind: 'json-object', requiredPaths: ['state.currentGoal', 'state.constraints', 'memory.session', 'memory.profile', 'memory.knowledge', 'tools.orderLookup.input.orderId', 'tools.orderLookup.failure'] }],
    hints: ['先让 state 只保存跨步骤真正需要的字段。', '工具失败返回应区分业务错误与可重试系统错误。'],
    reference: { outline: ['五步执行计划', '状态、记忆与工具合同'], exampleAnswers: { 'execution-plan': '第 1 步确认订单号；第 2 步查询并检查更新时间；第 3 步读取退款政策；第 4 步生成待确认方案；第 5 步验证状态和证据。', 'state-and-tools': '{ "state": { "currentGoal": "查询 A100", "constraints": ["退款前确认"] }, "memory": { "session": { "expires": "task-end" }, "profile": { "editable": true }, "knowledge": { "versioned": true } }, "tools": { "orderLookup": { "input": { "orderId": "A100" }, "failure": { "retryable": true } } } }' }, commonMistakes: ['步骤只有动作，没有检查结果。', '把订单状态永久写入用户画像。'] },
  }),
  'stop-and-recover': step({
    title: '项目草稿：为循环安装刹车', brief: '把继续执行会更糟的时刻写成可观察条件。', success: '五类停止都有用户说明、证据和恢复动作。', estimatedMinutes: 8,
    given: ['缺少订单号', '退款金额超过阈值', '工具连续超时', '已生成虚拟退款申请号'], deliverable: '完成 03-reliability.md。', constraints: ['最多重试两次', '不可恢复错误不能从头重复副作用'],
    milestoneStageId: 'multi-agent', milestoneTitle: '里程碑 3：让 Agent 可靠协作', fields: [reliability],
  }),
  'tool-reliability': step({
    title: '项目草稿：写出唯一工具路由', brief: '让实时公开信息、内部订单和确定计算各自进入正确工具。', success: '每类任务有唯一首选工具、预算和验证方式。', estimatedMinutes: 9,
    given: ['公开物流公告', '内部订单状态', '退款金额计算', '总步数预算为 4'], deliverable: '在 routing-and-handoff.json 中完成 budget 和 routes，handoff 可在下一关补齐。', constraints: ['搜索不能读取内部订单', '计算器不能替代权限校验', '未知任务返回澄清'],
    milestoneStageId: 'multi-agent', milestoneTitle: '里程碑 3：让 Agent 可靠协作', fields: [routingAndHandoff],
  }),
  'multi-agent': submit({
    title: '里程碑 3：让 Agent 可靠协作', brief: '完成停止、工具路由和责任边界；只有职责冲突时才拆角色。', success: '所有路径在预算内结束，工具选择唯一，最终责任人唯一。', estimatedMinutes: 18,
    given: ['前两关的可靠性与路由草稿', '研究、数据、写作、审核四个候选角色', '订单退款仍是统一案例'], deliverable: '补齐 03-reliability.md 和 routing-and-handoff.json，并运行里程碑 3 测试。', constraints: ['不为架构好看而拆多 Agent', '交接必须包含证据与未决问题', '只有一个 finalOwner'],
    milestoneId: 'milestone-3', artifactFiles: ['03-reliability.md', 'routing-and-handoff.json'], validationCommands: ['node --test --test-name-pattern="milestone 3"'], fields: [reliability, routingAndHandoff],
    rubric: [
      rubric('stop-coverage', '五类停止齐全', '完成、缺信息、高风险、预算、不可恢复错误均有安全路径。', '列出 03-reliability.md 的五个标题。', true),
      rubric('bounded-retry', '重试受预算约束', '最大步数、重试次数和恢复证据明确。', '指出 budget.maxSteps 和一次失败恢复规则。'),
      rubric('unique-routing', '工具路由唯一', '搜索、数据库和计算器职责不重叠。', '分别指出三类 route 的触发条件。'),
      rubric('single-owner', '最终责任唯一', '交接字段完整且只有一个最终负责人。', '指出 handoff.finalOwner 和 handoff.fields。', true),
    ],
    autoChecks: [{ id: 'routing-json', label: '路由与交接 JSON', fieldId: 'routing-and-handoff', kind: 'json-object', requiredPaths: ['budget.maxSteps', 'routes.search', 'routes.database', 'routes.calculator', 'handoff.finalOwner', 'handoff.fields'] }],
    hints: ['先证明单 Agent 无法同时承担的责任冲突，再决定是否拆分。', '交接至少包含任务、证据、置信度、未决问题和下一步。'],
    reference: { outline: ['停止与恢复说明', '路由、预算和交接合同'], exampleAnswers: { reliability: '缺订单号立即追问；高金额暂停确认；两次临时错误后停止；完成时返回虚拟申请号。', 'routing-and-handoff': '{ "budget": { "maxSteps": 4 }, "routes": { "search": { "for": "公开时效信息" }, "database": { "for": "内部订单" }, "calculator": { "for": "确定金额" } }, "handoff": { "finalOwner": "reviewer", "fields": ["task", "evidence", "confidence", "openQuestions"] } }' }, commonMistakes: ['所有工具都可以先试一次。', '多个角色都声称对最终结果负责。'] },
  }),
  'framework-choice': step({
    title: '项目草稿：先选最小实现', brief: '框架选择必须来自任务形状，而不是品牌或流行度。', success: '三个任务都有最小实现和不升级复杂度的理由。', estimatedMinutes: 7,
    given: ['固定日报：步骤固定、无高风险副作用', '退款流程：有状态、审批和恢复', '内容生产：研究与审核需要独立证据'], deliverable: '完成 04-implementation.md。', constraints: ['必须考虑维护和调试成本', '业务规则不能锁死在框架里'],
    milestoneStageId: 'intent-recognition', milestoneTitle: '里程碑 4：建立实现与评测包', fields: [implementation],
  }),
  'evaluation-monitoring': step({
    title: '项目草稿：把失败写成可判定样本', brief: '评测不是“回答得好不好”，而是给定输入时系统应做什么、不得做什么。', success: '至少 10 条样本覆盖五类风险，并有可观察期望。', estimatedMinutes: 10,
    given: ['normal、missing-input、stale-data、tool-failure、unauthorized 五个固定类别', '每类至少两条不同表达'], deliverable: '建立 eval-cases.json 的前 10 条样本。', constraints: ['越权样本不得调用订单工具', '缺参必须指出缺失字段', '期望不能写成“回答得好”'],
    milestoneStageId: 'intent-recognition', milestoneTitle: '里程碑 4：建立实现与评测包', fields: [evalCases],
  }),
  'intent-recognition': submit({
    title: '里程碑 4：建立实现与评测包', brief: '为固定样本补齐意图、槽位、缺参和期望证据，让实现选择可以被验证。', success: '最小实现有理由，10 条样本结构有效，正常与高风险行为均可判定。', estimatedMinutes: 20,
    given: ['前两关的实现选择和评测草稿', '订单查询意图 orderLookup', '地址修改意图 addressChange'], deliverable: '补齐 04-implementation.md 和 eval-cases.json，并运行里程碑 4 测试。', constraints: ['五类样本不可缺失', '高风险写操作必须有确认', '低置信或缺参必须澄清'],
    milestoneId: 'milestone-4', artifactFiles: ['04-implementation.md', 'eval-cases.json'], validationCommands: ['node --test --test-name-pattern="milestone 4"'], fields: [implementation, evalCases],
    rubric: [
      rubric('minimal-choice', '实现保持最小', '每个任务说明为什么不采用更复杂框架。', '指出 04-implementation.md 中三项“不选择”的理由。'),
      rubric('eval-coverage', '风险覆盖完整', '样本覆盖正常、缺参、过期、工具失败和越权。', '列出五个 category 及各自样本 ID。', true),
      rubric('intent-slots', '意图与槽位可执行', '每条样本包含意图、槽位、缺失字段和下一动作。', '指出一个缺参样本和一个多槽位样本。', true),
      rubric('observable-result', '期望结果可观察', '可以判断工具是否调用、是否确认、返回了什么证据。', '引用两条 expectedAction 和 expectedEvidence。'),
    ],
    autoChecks: [{ id: 'eval-json', label: '评测样本 JSON', fieldId: 'eval-cases', kind: 'json-array', minItems: 10, itemRequiredPaths: ['id', 'category', 'input', 'expectedAction', 'expectedEvidence'], requiredValues: { path: 'category', values: ['normal', 'missing-input', 'stale-data', 'tool-failure', 'unauthorized'] } }],
    hints: ['先写最危险的越权和写操作样本，再补正常样本。', 'expectedAction 应能检查“调用了什么”或“明确没有调用什么”。'],
    reference: { outline: ['最小实现比较', '十条结构化评测样本'], exampleAnswers: { 'implementation-choice': '固定日报用脚本；退款用显式状态工作流；只有独立研究和审核责任冲突时才拆多角色。', 'eval-cases': '[{ "id": "case-01", "category": "missing-input", "input": "帮我查一下", "expectedAction": "ask-order-id", "expectedEvidence": "order_lookup 未调用" }]' }, commonMistakes: ['样本只有正常对话。', '期望结果无法判断通过或失败。'] },
  }),
  'slots-confidence': step({
    title: '项目草稿：定义多意图与确认顺序', brief: '把“查订单并改地址”拆成两个动作，先解决依赖，再允许写操作。', success: '两个意图、必填槽位、依赖、确认和 fallback 都有明确合同。', estimatedMinutes: 9,
    given: ['输入：“查订单 A100，并把地址改到公司”', '地址修改必须先确认订单归属和状态', '“公司”不是完整地址'], deliverable: '完成 intent-schema.json。', constraints: ['查询和修改不得合成一个工具', '地址不完整必须追问', '修改前展示新旧值'],
    milestoneStageId: 'acceptance-iteration', milestoneTitle: '里程碑 5：完成助手蓝图并迭代', fields: [intentSchema],
  }),
  'assistant-design': step({
    title: '项目草稿：写完整助手规格', brief: '把之前的边界、工具、状态、可靠性和评测收进一条可以实现的主路径。', success: '陌生开发者无需口头补充即可搭建 Mock 版本。', estimatedMinutes: 12,
    given: ['前四个里程碑的产物', '输入只允许虚拟订单编号和用户意图', '任何写操作都必须确认'], deliverable: '完成 05-assistant-spec.md。', constraints: ['明确写出不支持项', '不得包含真实 API Key 或订单数据', '完成必须有可核验证据'],
    milestoneStageId: 'acceptance-iteration', milestoneTitle: '里程碑 5：完成助手蓝图并迭代', fields: [assistantSpec],
  }),
  'acceptance-iteration': submit({
    title: '里程碑 5：完成助手蓝图并迭代', brief: '运行整包测试，用一个真实失败完成最小修复和回归验证。', success: '规格、意图合同和评测相互一致，测试通过，并留下可复查的第一次迭代记录。', estimatedMinutes: 25,
    given: ['前四个里程碑的全部文件', '起始包中的无依赖 Node 测试', '至少一个首次运行失败或主动构造的失败样本'], deliverable: '完成三个最终文件，运行 npm test，并粘贴测试摘要。', constraints: ['每次只修一个主要失败原因', '不得删除失败样本来让测试通过', '测试和规格不得包含凭据'],
    milestoneId: 'milestone-5', artifactFiles: ['05-assistant-spec.md', 'intent-schema.json', 'iteration-report.md', '终端测试输出'], validationCommands: ['npm test'], fields: [assistantSpec, intentSchema, iterationReport, testOutput],
    rubric: [
      rubric('complete-flow', '主流程与失败流完整', '输入、状态、工具、确认、失败和完成证据可连成闭环。', '指出 05-assistant-spec.md 的主流程、失败和完成证据段落。', true),
      rubric('safe-write', '写操作受控', '地址修改或退款创建前都有身份、状态和人工确认。', '指出 intent-schema.json 的 confirmationRules。', true),
      rubric('regression-proof', '回归结果可复查', '修复后旧样本和新失败样本都通过。', '引用 iteration-report.md 的修复范围和测试证据。'),
      rubric('one-change', '迭代保持最小', '只改变一个主要原因，并写明保持不变的行为。', '指出迭代报告中的最小修复和保持项。'),
    ],
    autoChecks: [
      { id: 'intent-json', label: '意图合同 JSON', fieldId: 'intent-schema', kind: 'json-object', requiredPaths: ['intents.orderLookup', 'intents.addressChange', 'confirmationRules.addressChange', 'fallback'] },
      { id: 'node-tests', label: 'Node 测试摘要', fieldId: 'test-output', kind: 'test-output', requiredPhrases: ['pass', 'fail 0'] },
    ],
    hints: ['先运行测试并保留失败输出，再决定最小修复。', '最终检查：任何缺参、越权或未确认输入都不能触发写操作。'],
    reference: { outline: ['完整助手规格', '多意图合同', '第一次迭代报告', '本机测试证据'], exampleAnswers: { 'assistant-spec': '主流程：校验输入→查订单→展示允许动作→等待确认→执行虚拟动作→返回证据。', 'intent-schema': '{ "intents": { "orderLookup": {}, "addressChange": {} }, "confirmationRules": { "addressChange": { "required": true } }, "fallback": { "action": "clarify" } }', 'iteration-report': '越权样本触发了查询；修复是在工具调用前加入归属校验；所有旧样本和新增越权样本重新通过。', 'test-output': '# tests 5\n# pass 5\n# fail 0' }, commonMistakes: ['用删除失败样本代替修复。', 'AI 说“完成”但没有测试或外部状态证据。'] },
  }),
}
