import { createChapterActivities, field, jsonObjectCheck, testOutputCheck } from '../activityBuilders'

const stages = [
  ['vibe-mindset', 'ai-editor-foundations'], ['choose-the-mode', 'ai-editor-foundations'], ['editor-workspace', 'ai-editor-foundations'],
  ['install-and-verify', 'setup-and-scaffold'], ['account-and-rules', 'setup-and-scaffold'], ['scaffold-fullstack', 'setup-and-scaffold'],
  ['next-edit-suggestion', 'everyday-coding'], ['inline-chat', 'everyday-coding'], ['project-context', 'everyday-coding'],
  ['prompt-for-code', 'agentic-workflow'], ['quality-gates', 'agentic-workflow'], ['agent-plan-execute', 'agentic-workflow'],
  ['quest-and-long-tasks', 'project-delivery'], ['git-and-debug', 'project-delivery'], ['governance-and-mcp', 'project-delivery'],
].map(([id, unitId]) => ({ id, unitId, title: id.replaceAll('-', ' ') }))

const spec = field('task-spec', '任务规格与上下文图', '01-task-board-spec.md + context-map.json', 'json', '填写 project、userFlow、fileBoundaries、acceptance 和 contextFiles。', '{"project":"个人学习任务板","userFlow":["新增任务","标记完成"],"fileBoundaries":["src"],"acceptance":["npm test 通过"],"contextFiles":["package.json"]}')
const environment = field('environment', '环境与项目规则', '02-environment.md + PROJECT_RULES.md', 'markdown', '记录 Node/npm/Git 检查、忽略目录、权限边界和最小垂直切片。', '## Versions\nNode 20+\n## Ignore\nnode_modules, .env\n## Slice\nadd -> list -> complete')
const changeReview = field('change-review', 'AI 修改审查', '03-change-review.md + context-pack.json', 'json', '记录五条建议的 accept/modify/reject、修改范围、保持行为和上下文文件。', '{"decisions":[{"id":"d1","decision":"accept","reason":"局部且有测试"}],"changedFiles":["src/board.mjs"],"unchangedBehaviors":["任务 ID 稳定"],"contextFiles":["src/board.mjs","tests/board.test.mjs"]}')
const workflow = field('agent-workflow', 'Agent 工作流与质量门禁', '04-agent-workflow.md + quality-gates.json', 'json', '定义 inspect、plan、execute、verify、handoff 以及门禁命令。', '{"phases":["inspect","plan","execute","verify"],"gates":{"test":"npm test","lint":"npm run lint"},"handoff":{"requiredOn":["destructive-change"]}}')
const delivery = field('delivery', '长任务交付与治理', '05-delivery-report.md + governance.json', 'json', '填写五个里程碑、敏感目录排除、失败修订和最终状态。', '{"milestones":["spec","slice","review","workflow","delivery"],"excludedPaths":[".env","data/private"],"revision":{"failure":"边界测试失败","fix":"补输入校验"},"status":"ready"}')
const tests = field('test-output', '本机测试输出', '终端输出', 'test-output', '运行 npm test 并粘贴包含 pass 与 fail 0 的摘要。', '# pass 8\n# fail 0')

export const vibeCodingActivities = createChapterActivities({
  projectName: '个人学习任务板', starterPackUrl: '/practice/vibe-task-board-starter.zip',
  context: '你在本机制作一个只保存虚拟学习任务的任务板，用它练习需求、上下文、局部修改、质量门禁和长任务治理。',
  fixtures: ['固定任务字段：id、title、status、createdAt', '不接数据库和云服务，数据仅用内存 fixture', 'Node.js 20+ 与 node --test'],
  conceptStageIds: ['vibe-mindset', 'choose-the-mode'], stages,
  milestones: [
    { stageId: 'editor-workspace', title: '里程碑 1：锁定任务板规格', fields: [spec], artifactFiles: ['01-task-board-spec.md', 'context-map.json'], autoChecks: [jsonObjectCheck('spec-json', '规格结构', 'task-spec', ['project', 'userFlow', 'fileBoundaries', 'acceptance', 'contextFiles'])], rubricFocus: ['用户流程可验收', '文件边界明确', '上下文选择有依据'] },
    { stageId: 'scaffold-fullstack', title: '里程碑 2：跑通最小垂直切片', fields: [environment, tests], artifactFiles: ['02-environment.md', 'PROJECT_RULES.md', 'src/board.mjs', 'tests/board.test.mjs'], autoChecks: [testOutputCheck('slice-tests', '垂直切片测试')], rubricFocus: ['环境证据完整', '敏感目录排除', '最小切片可运行'] },
    { stageId: 'project-context', title: '里程碑 3：证明局部修改可控', fields: [changeReview, tests], artifactFiles: ['03-change-review.md', 'context-pack.json'], autoChecks: [jsonObjectCheck('review-json', '修改审查结构', 'change-review', ['decisions', 'changedFiles', 'unchangedBehaviors', 'contextFiles']), testOutputCheck('change-tests', '局部修改测试')], rubricFocus: ['五项决策有理由', '修改范围最小', '保持行为有证据'] },
    { stageId: 'agent-plan-execute', title: '里程碑 4：建立 Agent 工作流', fields: [workflow], artifactFiles: ['04-agent-workflow.md', 'quality-gates.json'], autoChecks: [jsonObjectCheck('workflow-json', '工作流结构', 'agent-workflow', ['phases', 'gates.test', 'handoff.requiredOn'])], rubricFocus: ['计划可修订', '门禁命令明确', '人工接管可触发'] },
    { stageId: 'governance-and-mcp', title: '里程碑 5：完成交付与治理', fields: [delivery, tests], artifactFiles: ['05-delivery-report.md', 'git-evidence.txt', 'governance.json'], autoChecks: [jsonObjectCheck('delivery-json', '交付结构', 'delivery', ['milestones', 'excludedPaths', 'revision.failure', 'revision.fix', 'status']), testOutputCheck('final-tests', '最终测试')], rubricFocus: ['五个里程碑齐全', 'Git 证据可复查', '失败修订真实'] },
  ],
})
