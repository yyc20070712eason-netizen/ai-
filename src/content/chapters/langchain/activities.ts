import { createChapterActivities, field, jsonArrayCheck, jsonObjectCheck, testOutputCheck } from '../activityBuilders'

const stages = [
  ['langchain-role', 'chain-foundations'], ['environment-and-model', 'chain-foundations'], ['core-concepts-map', 'chain-foundations'],
  ['prompt-template', 'prompts-and-messages'], ['chat-messages', 'prompts-and-messages'], ['few-shot-and-dynamic', 'prompts-and-messages'],
  ['tool-contract', 'tools'], ['tool-validation', 'tools'], ['bind-tools', 'tools'],
  ['agent-loop', 'agents'], ['multi-intent-agent', 'agents'], ['agent-memory', 'agents'],
  ['streaming', 'ship-an-assistant'], ['assistant-project', 'ship-an-assistant'], ['langchain-production', 'ship-an-assistant'],
].map(([id, unitId]) => ({ id, unitId, title: id.replaceAll('-', ' ') }))

const environment = field('environment', '组件图与环境报告', '01-component-map.md + environment-report.json', 'json', '填写 node、packages、mockModel、smokeResult 和 componentLayers。', '{"node":">=20","packages":{"@langchain/core":"1.2.8","langchain":"1.5.9","zod":"4.4.3"},"mockModel":true,"smokeResult":"pass","componentLayers":["prompt","model","tool","agent"]}')
const prompts = field('prompts', 'Prompt 与消息案例', '02-prompt-package.mjs + prompt-cases.json', 'json', '至少 4 条案例，包含 variables、roles、expectedText。', '[{"id":"p1","variables":{"topic":"attention"},"roles":["system","human"],"expectedText":"attention"}]')
const tools = field('tools', '工具合同与权限', '03-tools.mjs + tool-contracts.json', 'json', '填写 tools、inputSchema、output、errors、effect、confirmation。', '{"tools":{"read_plan":{"inputSchema":{"date":"string"},"effect":"read","confirmation":false},"save_plan":{"inputSchema":{"items":"array"},"effect":"write","confirmation":true}}}')
const core = field('assistant-core', 'Mock Agent 核心轨迹', '04-assistant-core.mjs + agent-traces.json', 'json', '至少 6 条轨迹，含 sessionId、intent、toolCalls、stopReason、memoryKeys。', '[{"id":"a1","sessionId":"s1","intent":"plan","toolCalls":["read_plan"],"stopReason":"completed","memoryKeys":["session:s1"]}]')
const release = field('release', '助手评测与生产清单', 'production-checklist.md + eval-cases.json', 'json', '填写 events、budgets、errors、rollback 和 cases。', '{"events":["text_delta","tool_start","tool_result","complete","error"],"budgets":{"maxSteps":4,"timeoutMs":1000},"errors":["validation","tool","cancelled"],"rollback":true,"cases":["normal","missing-input","tool-error"]}')
const tests = field('test-output', 'Mock 集成测试输出', '终端输出', 'test-output', '运行 npm test，粘贴零失败摘要。', '# pass 9\n# fail 0')

export const langChainActivities = createChapterActivities({
  projectName: '个人学习助手', starterPackUrl: '/practice/langchain-learning-assistant-starter.zip',
  context: '你使用官方 LangChain JavaScript 组件和确定性的 Mock 模型，构建不联网的个人学习助手。',
  fixtures: ['依赖固定为 @langchain/core 1.2.8、langchain 1.5.9、zod 4.4.3', 'Mock 模型按输入返回固定消息或工具调用', '所有写工具必须先确认'],
  conceptStageIds: ['langchain-role'], stages,
  milestones: [
    { stageId: 'core-concepts-map', title: '里程碑 1：验证组件与 Mock 环境', fields: [environment, tests], artifactFiles: ['01-component-map.md', 'environment-report.json'], autoChecks: [jsonObjectCheck('environment-json', '环境结构', 'environment', ['node', 'packages.@langchain/core', 'packages.langchain', 'packages.zod', 'mockModel', 'smokeResult', 'componentLayers']), testOutputCheck('smoke-tests', 'Runnable smoke test')], rubricFocus: ['组件职责分层', '依赖版本固定', '无 Key 可运行'] },
    { stageId: 'few-shot-and-dynamic', title: '里程碑 2：完成 Prompt 包', fields: [prompts, tests], artifactFiles: ['02-prompt-package.mjs', 'prompt-cases.json'], autoChecks: [jsonArrayCheck('prompt-json', 'Prompt 案例', 'prompts', 4, ['id', 'variables', 'roles', 'expectedText']), testOutputCheck('prompt-tests', 'Prompt 测试')], rubricFocus: ['输入变量完整', '消息角色顺序正确', '动态上下文受控'] },
    { stageId: 'bind-tools', title: '里程碑 3：建立工具安全层', fields: [tools, tests], artifactFiles: ['03-tools.mjs', 'tool-contracts.json'], autoChecks: [jsonObjectCheck('tools-json', '工具合同', 'tools', ['tools.read_plan.inputSchema', 'tools.read_plan.effect', 'tools.save_plan.inputSchema', 'tools.save_plan.effect', 'tools.save_plan.confirmation']), testOutputCheck('tool-tests', '工具测试')], rubricFocus: ['参数校验明确', '读写权限分离', '副作用需要确认'] },
    { stageId: 'agent-memory', title: '里程碑 4：跑通 Mock Agent 循环', fields: [core, tests], artifactFiles: ['04-assistant-core.mjs', 'agent-traces.json'], autoChecks: [jsonArrayCheck('traces-json', 'Agent 轨迹', 'assistant-core', 6, ['id', 'sessionId', 'intent', 'toolCalls', 'stopReason', 'memoryKeys']), testOutputCheck('agent-tests', 'Agent 测试')], rubricFocus: ['工具路由可复查', '会话记忆不串线', '停止证据明确'] },
    { stageId: 'langchain-production', title: '里程碑 5：交付个人学习助手', fields: [release, tests], artifactFiles: ['05-learning-assistant', 'production-checklist.md', 'eval-cases.json'], autoChecks: [jsonObjectCheck('release-json', '生产清单', 'release', ['events', 'budgets.maxSteps', 'budgets.timeoutMs', 'errors', 'rollback', 'cases']), testOutputCheck('integration-tests', 'Mock 集成测试')], rubricFocus: ['流事件完整', '预算与错误可控', '升级可回滚'] },
  ],
})
