import { createChapterActivities, field, jsonArrayCheck, jsonObjectCheck, testOutputCheck } from '../activityBuilders'

const stages = [
  ['why-langgraph', 'graph-foundations'], ['langgraph-vs-langchain', 'graph-foundations'], ['environment-smoke-test', 'graph-foundations'],
  ['state-schema', 'state-and-nodes'], ['node-contracts', 'state-and-nodes'], ['edges-and-boundaries', 'state-and-nodes'],
  ['compile-first-graph', 'control-flow'], ['reducers', 'control-flow'], ['conditional-routing', 'control-flow'], ['controlled-loops', 'control-flow'],
  ['messages-state', 'messages-and-tools'], ['chatbot-graph', 'messages-and-tools'], ['tool-node', 'messages-and-tools'],
  ['react-graph', 'reliable-agents'], ['persistence-and-resume', 'reliable-agents'], ['interrupt-and-production', 'reliable-agents'],
].map(([id, unitId]) => ({ id, unitId, title: id.replaceAll('-', ' ') }))

const smoke = field('environment', '图环境与 smoke test', '01-graph-smoke.mjs + environment-report.json', 'json', '填写 node、packages、path、result 和 mockOnly。', '{"node":">=20","packages":{"@langchain/core":"1.2.8","@langchain/langgraph":"1.4.10"},"path":["START","hello","END"],"result":"hello","mockOnly":true}')
const state = field('state-graph', 'State、Node 与 Edge 合同', '02-state-graph.mjs + state-contract.json', 'json', '填写 fields、owners、nodes、routes 和 terminalStates。', '{"fields":{"topic":"string","status":"string"},"owners":{"topic":"input","status":"router"},"nodes":["normalize","route"],"routes":{"ready":"END","missing":"clarify"},"terminalStates":["END"]}')
const control = field('control-flow', 'Reducer、路由与循环案例', '03-control-flow.mjs + control-flow-cases.json', 'json', '至少 6 条案例覆盖 overwrite、append、dedupe、low-confidence、budget、fallback。', '[{"id":"c1","category":"budget","input":{"iteration":3},"expectedRoute":"fallback","expectedState":{"status":"stopped"}}]')
const messages = field('messages', '消息与工具图轨迹', '04-message-tool-graph.mjs + message-traces.json', 'json', '至少 5 条轨迹，含 threadId、messages、toolCallId、toolResult、stopReason。', '[{"id":"m1","threadId":"thread-a","messages":["human","ai-tool","tool","ai"],"toolCallId":"call-1","toolResult":"ok","stopReason":"completed"}]')
const resume = field('resume', '暂停、恢复与生产护栏', 'resume-cases.json + production-guardrails.md', 'json', '至少 6 条案例，覆盖 approved、rejected、timeout、restart、duplicate-resume、tool-error。', '[{"id":"x1","category":"approved","threadId":"t1","checkpointVersion":1,"interruptState":"waiting","decision":"approve","expectedSideEffectCount":1,"finalState":"completed"}]')
const tests = field('test-output', 'Mock 图测试输出', '终端输出', 'test-output', '运行 npm test，粘贴零失败摘要。', '# pass 13\n# fail 0')

export const langGraphActivities = createChapterActivities({
  projectName: '可暂停、可恢复的学习流程图', starterPackUrl: '/practice/langgraph-study-flow-starter.zip',
  context: '你使用 LangGraph JavaScript 和 Mock 节点构建学习计划流程，流程可暂停等待确认、恢复并避免重复写入。',
  fixtures: ['依赖固定为 @langchain/core 1.2.8、@langchain/langgraph 1.4.10', '虚拟副作用仅向内存数组追加计划项', '每次运行必须有 thread_id 与循环预算'],
  conceptStageIds: ['why-langgraph', 'langgraph-vs-langchain'], stages,
  milestones: [
    { stageId: 'environment-smoke-test', title: '里程碑 1：编译第一张图', fields: [smoke, tests], artifactFiles: ['01-graph-smoke.mjs', 'environment-report.json'], autoChecks: [jsonObjectCheck('smoke-json', '图环境', 'environment', ['node', 'packages.@langchain/core', 'packages.@langchain/langgraph', 'path', 'result', 'mockOnly']), testOutputCheck('smoke-tests', '图 smoke test')], rubricFocus: ['图可编译', '路径可观察', '无 Key 可运行'] },
    { stageId: 'edges-and-boundaries', title: '里程碑 2：定义状态图合同', fields: [state, tests], artifactFiles: ['02-state-graph.mjs', 'state-contract.json'], autoChecks: [jsonObjectCheck('state-json', '状态合同', 'state-graph', ['fields', 'owners', 'nodes', 'routes', 'terminalStates']), testOutputCheck('state-tests', '状态图测试')], rubricFocus: ['字段所有权明确', '节点单一职责', '所有路由有目标'] },
    { stageId: 'controlled-loops', title: '里程碑 3：控制分支与循环', fields: [control, tests], artifactFiles: ['03-control-flow.mjs', 'control-flow-cases.json'], autoChecks: [jsonArrayCheck('control-json', '控制流案例', 'control-flow', 6, ['id', 'category', 'input', 'expectedRoute', 'expectedState'], { path: 'category', values: ['overwrite', 'append', 'dedupe', 'low-confidence', 'budget', 'fallback'] }), testOutputCheck('control-tests', '控制流测试')], rubricFocus: ['Reducer 语义正确', '低置信有兜底', '循环在预算内终止'] },
    { stageId: 'tool-node', title: '里程碑 4：连接消息与工具', fields: [messages, tests], artifactFiles: ['04-message-tool-graph.mjs', 'message-traces.json'], autoChecks: [jsonArrayCheck('message-json', '消息轨迹', 'messages', 5, ['id', 'threadId', 'messages', 'toolCallId', 'toolResult', 'stopReason']), testOutputCheck('message-tests', '消息工具测试')], rubricFocus: ['消息顺序合法', '工具调用 ID 对齐', '线程隔离'] },
    { stageId: 'interrupt-and-production', title: '里程碑 5：实现可靠暂停与恢复', fields: [resume, tests], artifactFiles: ['05-reliable-study-graph', 'resume-cases.json', 'production-guardrails.md'], autoChecks: [jsonArrayCheck('resume-json', '恢复案例', 'resume', 6, ['id', 'category', 'threadId', 'checkpointVersion', 'interruptState', 'decision', 'expectedSideEffectCount', 'finalState'], { path: 'category', values: ['approved', 'rejected', 'timeout', 'restart', 'duplicate-resume', 'tool-error'] }), testOutputCheck('resume-tests', '暂停恢复测试')], rubricFocus: ['中断状态可解释', '检查点版本明确', '恢复不重复副作用'] },
  ],
})
