import { defineCourseChapter, type CourseStageSeed } from '../factory'
import { aiHarnessActivities } from './activities'

const sourceUrl = 'https://gcnum0i2ctpz.feishu.cn/docx/Y3YVdniSXob4YpxvGtBcUYtenTg'

const stages: CourseStageSeed[] = [
  {
    id: 'harness-mindset', unitId: 'from-chat-to-workbench', title: '从会问 AI 到会搭工作台', sourceLabel: 'Harness Agent 的基本概念', sourceHash: '#doxcn79hHIRJNaYEeFtSCywiGUd',
    problem: '同一个开发任务反复交给 AI，结果每次都不同，团队无法稳定复用', outcome: '能用工作台视角解释 Harness，并判断一个 AI 编码流程缺少什么',
    insight: 'Harness 不是更长的提示词，而是围绕模型建立任务、上下文、工具、状态与验证的工作环境。', mechanism: '模型能力决定上限，Harness 决定能力能否稳定落到真实工程结果。',
    steps: ['写清任务与边界', '提供最小必要上下文和工具', '用验证结果闭环'], misconception: '模型够强就不需要工程约束', decision: '先列出任务、证据、工具、状态和验收五类缺口', risk: '输出看似完整，但无法复现也无法验收',
    concepts: ['任务工作台', '上下文边界', '验证闭环', '可复现执行'], practice: '选一个最近做过的 AI 任务，画出模型之外还需要的五类支撑。', success: '能指出至少三个模型外部的工程组件，并说明各自失败时会发生什么。',
  },
  {
    id: 'prompt-context-harness', unitId: 'from-chat-to-workbench', title: '区分 Prompt、Context 与 Harness', sourceLabel: 'Prompt / Context / Harness Engineering', sourceHash: '#doxcnEnSnQVEadUuJAcSL8zDmSh',
    problem: '团队把所有 AI 失败都归咎于提示词，越改越长却没有改善', outcome: '能把问题正确归类到表达、资料或执行环境，而不是盲目改提示词',
    insight: 'Prompt Engineering 解决怎么说，Context Engineering 解决给什么，Harness Engineering 解决怎样持续完成工作。', mechanism: '三层问题的故障位置不同，混在一起会让修复动作失焦。',
    steps: ['判断缺的是指令、资料还是流程', '只修改对应层', '用同一验收样例复测'], misconception: '上下文和 Harness 都只是提示词的一部分', decision: '先按指令、上下文、执行环境三层定位失败', risk: '提示词越来越复杂，但工具和验证仍然缺失',
    concepts: ['指令表达', '上下文供给', '执行环境', '分层诊断'], practice: '给三个失败案例分别贴上 Prompt、Context 或 Harness 标签，并写出修复动作。', success: '每个案例只能落入一个主要故障层，且修复动作与该层直接对应。',
  },
  {
    id: 'vibe-coding-limits', unitId: 'from-chat-to-workbench', title: '看见 Vibe Coding 的五个失控点', sourceLabel: '为什么 Vibe Coding 不够？', sourceHash: '#doxcnqyZMJq2k6KFbuGn8Vp7Q1c',
    problem: '原型很快完成，但需求漂移、上下文爆炸、错误自信和权限越界一起出现', outcome: '能在动手前识别 Vibe Coding 何时需要升级成工程化 Harness',
    insight: 'Vibe Coding 适合探索，不自动等于可交付；规模一大，隐性状态和验证债务会迅速累积。', mechanism: '任务跨度越长，模型遗忘、误判和局部最优越容易叠加成系统性失败。',
    steps: ['记录需求与不可变约束', '识别上下文和权限边界', '加入可重复验证'], misconception: '代码能运行一次就等于需求已经正确实现', decision: '先把五类失控风险转成可检查清单', risk: '功能演示正常，真实数据或边界场景立即失败',
    concepts: ['需求漂移', '上下文预算', '验证债务', '安全边界'], practice: '为一个 AI 生成的小功能做需求漂移、上下文、正确性、自信和权限五项体检。', success: '每项风险都有证据、严重度和一个具体控制动作。',
  },
  {
    id: 'task-specification', unitId: 'control-the-task', title: '用任务规格阻止目标漂移', sourceLabel: '6.1 任务规格：让目标别漂', sourceHash: '#doxcnhlRlVSxugixBAqb5sBKXPd',
    problem: 'Agent 做到一半开始顺手重构无关模块，结果范围不断扩大', outcome: '能写出包含目标、范围、约束和验收的任务规格',
    insight: '任务规格是 Agent 的合同：说明要改变什么、不能改变什么、怎样证明完成。', mechanism: '显式范围和验收让每个中间决策都有可比较的参照，而不是靠对话记忆。',
    steps: ['定义可观察目标', '列出范围与禁止项', '把验收写成可执行检查'], misconception: '一句“帮我优化一下”足够让 Agent 自己理解所有边界', decision: '先写四段式任务规格，再授权执行', risk: '改动很多，却无法判断是否完成原始目标',
    concepts: ['目标', '范围', '约束', '验收标准'], practice: '把“优化登录功能”改写成目标、范围、约束、验收四段式规格。', success: '另一位同学无需追问即可判断哪些文件可改以及何时算完成。',
  },
  {
    id: 'context-selection', unitId: 'control-the-task', title: '只给完成任务所需的上下文', sourceLabel: '6.2 上下文选择', sourceHash: '#doxcnLYH54uV1tG1ADGaA6yIyXc',
    problem: '团队把整个仓库塞进上下文，模型反而忽略关键约束并产生冲突建议', outcome: '能按任务选择高信号上下文，并控制上下文预算',
    insight: '上下文不是越多越好；正确做法是让每段材料都能改变当前决策。', mechanism: '无关内容占用注意力和窗口预算，会稀释关键规则并增加错误关联。',
    steps: ['从任务决策反推所需证据', '优先加载规则与接口', '缺什么再渐进检索'], misconception: '全量上下文一定比精选上下文更准确', decision: '先列决策问题，再逐项选择能回答它的材料', risk: '模型引用了旧文件或无关示例，忽略当前接口',
    concepts: ['上下文预算', '信号密度', '渐进检索', '证据边界'], practice: '面对一个跨三文件的 bug，从十个候选文件中挑出首轮最小上下文。', success: '每个入选文件都对应一个明确决策，且说明其余文件何时才需要加载。',
  },
  {
    id: 'tools-and-memory', unitId: 'control-the-task', title: '给少而精的工具与项目记忆', sourceLabel: '6.3–6.4 工具访问与项目记忆', sourceHash: '#doxcnBDc6OhVTe4uCx2sWKyTJXc',
    problem: 'Agent 有几十个工具，却选错命令；重要约定只留在聊天里，下次全部忘记', outcome: '能设计最小工具集，并把长期事实写进仓库记忆',
    insight: '工具决定 Agent 能做什么，项目记忆决定它跨会话仍知道哪些长期事实。', mechanism: '清晰的工具描述减少选择歧义，仓库内记忆让约束可版本化、可审查。',
    steps: ['只暴露任务必需工具', '写清参数、副作用和失败', '把稳定约定落到项目文件'], misconception: '工具越多越强，聊天记录就是最好的长期记忆', decision: '先裁剪工具，再把长期规则写进可审查文件', risk: 'Agent 调错工具或重复探索已经确定的项目事实',
    concepts: ['最小工具集', '工具契约', '项目记忆', '可审查边界'], practice: '为代码审查 Agent 设计不超过五个工具，并写一页项目记忆。', success: '每个工具用途互斥，项目记忆只包含稳定事实且可由团队审查。',
  },
  {
    id: 'state-and-progress', unitId: 'make-it-verifiable', title: '让复杂任务拥有显式状态', sourceLabel: '6.5 状态管理：复杂任务必须有进度文件', sourceHash: '#doxcnQxMZsimdWhBVHgLzy2Xg7d',
    problem: '长任务中断后 Agent 不知道已经完成什么，重复修改或跳过步骤', outcome: '能设计可恢复的任务状态与进度记录',
    insight: '状态文件把计划、证据、完成项和阻塞项从模型记忆中搬到可持久化系统。', mechanism: '显式状态允许重启、接管和审计，避免把一次会话当作唯一真相。',
    steps: ['定义有限状态和转移条件', '每步记录证据与下一步', '恢复时先校验状态'], misconception: '只要上下文窗口足够大，就不需要持久化进度', decision: '先设计状态机和恢复点，再运行长任务', risk: '中断后重复执行有副作用的步骤',
    concepts: ['任务状态', '转移条件', '检查点', '可恢复执行'], practice: '为“升级依赖并修复测试”设计待办、进行中、验证中、完成、阻塞状态。', success: '任意时刻中断后，另一进程能根据记录安全继续且不会重复副作用。',
  },
  {
    id: 'verification-loop', unitId: 'make-it-verifiable', title: '用验证替代“我觉得对”', sourceLabel: '6.6 验证机制', sourceHash: '#doxcn7Ys1P2rbJUdW18N9AFqyAf',
    problem: 'Agent 宣布修复完成，但测试没跑、边界没查、产物也没有核对', outcome: '能把目标转换为自动检查与人工抽查组成的验证闭环',
    insight: '验证不是最后一步，而是每次行动后产生新证据的反馈回路。', mechanism: '快速、确定的检查能限制错误扩散，并为下一步提供可信状态。',
    steps: ['为目标选择最小验证', '执行并保存结果', '失败时定位后再迭代'], misconception: '模型对自己结果的解释可以替代测试', decision: '先定义验证命令与通过条件，再让 Agent 修改', risk: '表面问题消失，但回归或数据损坏未被发现',
    concepts: ['可执行验收', '反馈回路', '失败定位', '证据化完成'], practice: '为一个表单校验修复设计单元、集成和视觉三层最小验证。', success: '每条验收都有对应检查，且失败结果能指向具体责任层。',
  },
  {
    id: 'permissions-sandbox', unitId: 'make-it-verifiable', title: '把 Agent 放进权限围栏', sourceLabel: '6.7 权限和沙箱', sourceHash: '#doxcnufs5rt1OaJHBW1QjlXLcgf',
    problem: '一个本应只读分析的 Agent 获得删除和外发权限，错误动作难以恢复', outcome: '能按最小权限、可逆性和确认点设计 Agent 执行边界',
    insight: '权限是产品能力的一部分；默认只给完成当前步骤所需的最小权力。', mechanism: '沙箱、作用域和人工确认把单次错误的影响限制在可恢复范围。',
    steps: ['按读写与外部影响分级', '优先使用可逆动作', '高风险动作前设置确认'], misconception: '个人使用就不需要权限控制', decision: '先做权限矩阵并默认拒绝未声明副作用', risk: '误删文件、泄露数据或对外产生不可逆影响',
    concepts: ['最小权限', '可逆操作', '确认点', '副作用边界'], practice: '为资料整理 Agent 列出读取、写入、删除、上传四类权限及确认规则。', success: '任何不可逆或外部动作都需要明确授权，且失败有恢复路径。',
  },
  {
    id: 'observability', unitId: 'operate-and-improve', title: '让每一步都能被复盘', sourceLabel: '6.8 可观测性', sourceHash: '#doxcnr3tvHYPnkriFt5INlyxn4g',
    problem: 'Agent 最终失败，但团队只看到一句错误，无法知道哪个决策开始偏离', outcome: '能设计不泄露敏感信息的任务轨迹、指标和错误记录',
    insight: '可观测性记录“发生了什么、为什么做、证据是什么”，而不只是最终日志。', mechanism: '结构化事件让失败可定位、成功可比较，也为评估和改进提供数据。',
    steps: ['记录关键状态转移', '保存工具结果摘要和耗时', '对敏感正文做最小化'], misconception: '把所有提示词和原文完整写进日志最方便排查', decision: '先定义安全事件字段与关联 ID', risk: '既无法复盘，又可能在日志中泄露正文和密钥',
    concepts: ['任务轨迹', '结构化事件', '关联标识', '隐私最小化'], practice: '为一次工具调用设计开始、成功、失败三类日志事件。', success: '日志能串起一次任务且不包含密钥、完整原文或无关用户数据。',
  },
  {
    id: 'human-handoff', unitId: 'operate-and-improve', title: '设计人类接管而非假装全自动', sourceLabel: '6.9 人类接管', sourceHash: '#doxcnQQvQjBNNXTNHmh9fIkmpee',
    problem: 'Agent 遇到模糊需求仍继续猜测，最后把高风险决定隐藏在自动流程中', outcome: '能定义何时暂停、向人展示什么、如何安全恢复',
    insight: '高质量自动化知道自己的边界；接管点是可靠性机制，不是失败。', mechanism: '把低置信、高影响和授权缺失转成明确暂停条件，可避免错误继续放大。',
    steps: ['定义暂停触发器', '整理选项、证据与影响', '用户决定后从检查点恢复'], misconception: '真正高级的 Agent 不应该打扰人类', decision: '先把高影响与低置信决策列为接管点', risk: '系统在不确定时自信执行不可逆动作',
    concepts: ['暂停条件', '决策包', '人工授权', '安全恢复'], practice: '为自动部署 Agent 设计三个必须停下来找人的场景。', success: '每个接管场景都给出选项、证据、风险和恢复位置。',
  },
  {
    id: 'minimal-harness', unitId: 'operate-and-improve', title: '组装一个最小可验证 Harness', sourceLabel: '一个可以验证的最小 Harness 案例', sourceHash: '#doxcnA9rdJ8oXN5vWOIDPLcgpNe',
    problem: '概念都懂了，但落到项目时仍是一段聊天加一次性脚本', outcome: '能把规格、执行、测试、状态和日志组合成最小 Harness',
    insight: '最小 Harness 不追求平台化，先让一个窄任务可重复、可验证、可恢复。', mechanism: '把组件围绕单一验收目标串成闭环，比先建设通用框架更容易验证价值。',
    steps: ['选择一个窄任务和测试', '串联读取、修改、验证与记录', '故意制造失败并验证恢复'], misconception: '要做 Harness 必须先搭建庞大的 Agent 平台', decision: '先实现一个任务的端到端闭环', risk: '组件很多但彼此不连通，无法证明可靠性提升',
    concepts: ['任务规格', '执行循环', '自动测试', '恢复检查点'], practice: '按照原文 cart.py 案例，写出输入、执行、测试、状态和失败恢复五步流程。', success: '重复运行得到一致结果，测试失败时停止，并能从保存状态继续。',
    codeTitle: '最小 Harness 伪代码', code: `spec = load_spec()\nstate = load_checkpoint()\nresult = agent.run(spec, state)\nverify(result)\nsave_checkpoint(result)`,
  },
]

export default defineCourseChapter({
  id: 'ai-harness', title: 'AI Harness 入门与实践', shortTitle: 'AI Harness', order: 2, prerequisites: ['agent'],
  sourceId: 'ai-harness-manual', sourceTitle: '万字详解！AI Harness 入门与实践！', sourceUrl,
  units: [
    { id: 'from-chat-to-workbench', title: '从聊天到工作台', stageIds: ['harness-mindset', 'prompt-context-harness', 'vibe-coding-limits'] },
    { id: 'control-the-task', title: '控制任务与上下文', stageIds: ['task-specification', 'context-selection', 'tools-and-memory'] },
    { id: 'make-it-verifiable', title: '让执行可验证', stageIds: ['state-and-progress', 'verification-loop', 'permissions-sandbox'] },
    { id: 'operate-and-improve', title: '运行、接管与改进', stageIds: ['observability', 'human-handoff', 'minimal-harness'] },
  ],
  stages,
  activities: aiHarnessActivities,
})
