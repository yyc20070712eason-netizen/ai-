import { createChapterActivities, field, jsonObjectCheck, testOutputCheck } from '../activityBuilders'

const stages = [
  ['harness-mindset', 'from-chat-to-workbench'], ['prompt-context-harness', 'from-chat-to-workbench'], ['vibe-coding-limits', 'from-chat-to-workbench'],
  ['task-specification', 'control-the-task'], ['context-selection', 'control-the-task'], ['tools-and-memory', 'control-the-task'],
  ['state-and-progress', 'make-it-verifiable'], ['verification-loop', 'make-it-verifiable'], ['permissions-sandbox', 'make-it-verifiable'],
  ['observability', 'operate-and-improve'], ['human-handoff', 'operate-and-improve'], ['minimal-harness', 'operate-and-improve'],
].map(([id, unitId]) => ({ id, unitId, title: id.replaceAll('-', ' ') }))

const diagnosis = field('diagnosis', 'Harness 故障与风险登记', '01-harness-diagnosis.md + risk-register.json', 'json', '填写 risks，每项含 id、layer、severity、trigger、control。', '{"risks":[{"id":"r1","layer":"context","severity":"high","trigger":"读取 .env","control":"deny-path"}]}')
const taskPackage = field('task-package', '任务、上下文和工具政策', '02-task-package.md + context-manifest.json + tool-policy.json', 'json', '填写 objective、scope、contextFiles、allowedTools、deniedPaths、confirmOn。', '{"objective":"更新虚拟学习计划","scope":["fixtures/plan.json"],"contextFiles":["TASK.md"],"allowedTools":["read","patch","test"],"deniedPaths":[".env","data/private"],"confirmOn":["delete","network"]}')
const contract = field('execution-contract', '执行、状态与验证合同', '03-execution-contract.json + state-and-progress.json', 'json', '填写 states、transitions、checkpoint、verification、sandbox。', '{"states":["ready","running","blocked","verifying","done"],"transitions":{"ready":["running"],"running":["blocked","verifying"]},"checkpoint":{"version":1,"taskId":"t1"},"verification":["unit","integration"],"sandbox":{"writeRoots":["fixtures"]}}')
const harness = field('minimal-harness', '最小 Harness 运行记录', '04-minimal-harness + observability.json', 'json', '填写 correlationId、events、handoff、resumeFrom、finalStatus、sideEffectCount。', '{"correlationId":"run-1","events":["task_started","tool_started","verification_failed","human_required","resumed","completed"],"handoff":{"reason":"verification-failed","options":["fix","stop"]},"resumeFrom":"checkpoint-2","finalStatus":"completed","sideEffectCount":1}')
const tests = field('test-output', 'Mock 任务测试输出', '终端输出', 'test-output', '运行 npm test，粘贴零失败摘要。', '# pass 11\n# fail 0')

export const aiHarnessActivities = createChapterActivities({
  projectName: '个人 AI 任务执行工作台', starterPackUrl: '/practice/ai-harness-workbench-starter.zip',
  context: '你为一个只修改虚拟学习计划 fixture 的本地任务建立规格、权限、状态、验证、接管和恢复闭环。',
  fixtures: ['唯一可写文件：fixtures/plan.json', '禁止路径：.env、data/private、任意父目录', 'Mock 执行器不会调用真实模型或网络'],
  conceptStageIds: ['harness-mindset', 'prompt-context-harness'], stages,
  milestones: [
    { stageId: 'vibe-coding-limits', title: '里程碑 1：完成 Harness 风险诊断', fields: [diagnosis], artifactFiles: ['01-harness-diagnosis.md', 'risk-register.json'], autoChecks: [jsonObjectCheck('risk-json', '风险登记', 'diagnosis', ['risks'])], rubricFocus: ['五类失控点可区分', '严重度有理由', '每项有控制动作'] },
    { stageId: 'tools-and-memory', title: '里程碑 2：锁定任务与权限', fields: [taskPackage], artifactFiles: ['02-task-package.md', 'context-manifest.json', 'tool-policy.json'], autoChecks: [jsonObjectCheck('task-json', '任务包结构', 'task-package', ['objective', 'scope', 'contextFiles', 'allowedTools', 'deniedPaths', 'confirmOn'])], rubricFocus: ['目标范围可验收', '上下文保持最小', '工具最小权限'] },
    { stageId: 'permissions-sandbox', title: '里程碑 3：建立可恢复执行合同', fields: [contract, tests], artifactFiles: ['03-execution-contract.json', 'verification-plan.md', 'state-and-progress.json'], autoChecks: [jsonObjectCheck('contract-json', '执行合同', 'execution-contract', ['states', 'transitions', 'checkpoint.version', 'checkpoint.taskId', 'verification', 'sandbox.writeRoots']), testOutputCheck('contract-tests', '权限与恢复测试')], rubricFocus: ['状态转移有限', '检查点可恢复', '沙箱不可越界'] },
    { stageId: 'minimal-harness', title: '里程碑 4：交付最小 Harness', fields: [harness, tests], artifactFiles: ['04-minimal-harness', 'observability.json', 'handoff.md'], autoChecks: [jsonObjectCheck('harness-json', '运行记录', 'minimal-harness', ['correlationId', 'events', 'handoff.reason', 'handoff.options', 'resumeFrom', 'finalStatus', 'sideEffectCount']), testOutputCheck('harness-tests', 'Mock Harness 测试')], rubricFocus: ['事件可串联', '人工接管信息充分', '恢复不重复副作用'] },
  ],
})
