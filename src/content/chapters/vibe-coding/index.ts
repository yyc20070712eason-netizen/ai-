import { defineCourseChapter, type CourseStageSeed } from '../factory'
import { vibeCodingActivities } from './activities'

const sourceUrl = 'https://gcnum0i2ctpz.feishu.cn/docx/JvSHdKGWzojU5HxV1g2ctE6Mn23'

const stages: CourseStageSeed[] = [
  {
    id: 'vibe-mindset', unitId: 'ai-editor-foundations', title: '从补全代码到协作式开发', sourceLabel: '第一章 AI 编辑器课程介绍', sourceHash: '#doxcn4XiDND3U2yoSuyTM9Sdfdc', problem: '把 AI 编辑器只当作更聪明的自动补全，仍用传统逐行操作方式工作', outcome: '能把需求、上下文、生成、验证和迭代看成完整协作循环', insight: 'Vibe Coding 的价值不是少打字，而是用自然语言表达意图，让 AI 参与理解、修改和验证。', mechanism: '当上下文和验收清楚时，AI 可跨文件执行；边界不清时也会更快放大错误。', steps: ['描述目标和约束', '提供相关项目上下文', '小步生成并立即验证'], misconception: '只要描述想法，AI 会自动补齐所有隐含需求', decision: '先把意图改写成可验收任务再生成', risk: '代码很多但方向错误，返工成本更高', concepts: ['开发意图', '项目上下文', '小步生成', '验证反馈'], practice: '把“做一个登录页”改成包含用户流程、范围和验收的任务卡。', success: 'AI 无需猜测技术栈、边界、交互和完成标准。',
  },
  {
    id: 'choose-the-mode', unitId: 'ai-editor-foundations', title: '选择补全、对话还是 Agent', sourceLabel: 'Ask 模式与 Agent 模式的区别', sourceHash: '#doxcnsD2OYs6BrIM3D8kovOrQnf', problem: '所有任务都直接交给 Agent，简单问题变慢，高风险任务又缺少控制', outcome: '能按任务影响范围选择 NES、Inline Chat、Ask 或 Agent', insight: '模式越主动，能修改的范围和副作用越大；选择应匹配任务复杂度与风险。', mechanism: '补全服务局部输入，对话帮助理解或单点修改，Agent 负责多步跨文件执行。', steps: ['评估任务跨度与副作用', '选择最小足够模式', '扩大权限前检查计划'], misconception: 'Agent 模式永远比 Ask 模式更高级', decision: '先选最小足够能力而不是最大自动化', risk: '简单改动被过度执行或复杂任务缺少规划', concepts: ['智能补全', '内联对话', 'Ask 模式', 'Agent 模式'], practice: '为解释报错、改一个函数、跨端新增功能分别选择模式。', success: '每项选择与文件跨度、工具需求和风险一致。',
  },
  {
    id: 'editor-workspace', unitId: 'ai-editor-foundations', title: '整理高信号工作区', sourceLabel: '深入解析 Qoder 界面各面板', sourceHash: '#doxcn8GMyWt3ThIqPWFCfj3lVed', problem: '打开很多无关文件和面板，AI 选错上下文，自己也无法追踪改动', outcome: '能配置文件树、编辑区、终端、问题面板和上下文选择', insight: 'AI 编辑器仍是工程工作台；可见文件、选区、诊断和终端结果决定协作质量。', mechanism: '清晰布局减少认知切换，也让你能及时发现 AI 修改与运行结果的偏差。', steps: ['固定项目与诊断入口', '只保留任务相关上下文', '把终端验证纳入同一工作流'], misconception: '界面布局只影响美观，不影响 AI 结果', decision: '先建立任务所需面板和上下文入口', risk: '修改未审查、错误面板被忽略或终端运行错目录', concepts: ['工作区布局', '上下文选择', '诊断面板', '终端证据'], practice: '为一次前后端联调安排最小面板和检查顺序。', success: '代码、日志、网络错误和改动差异都能在一个工作流中核查。',
  },
  {
    id: 'install-and-verify', unitId: 'setup-and-scaffold', title: '安装并验证全栈环境', sourceLabel: '第2集 下载安装与全栈环境验证', sourceHash: '#doxcnOxpvlzWTlNHejmezFRJwld', problem: '编辑器装好了，但 Java、Node、Git 或终端路径不一致，生成项目无法启动', outcome: '能用版本检查和最小项目验证完整工具链', insight: '安装完成的证据是编辑器、语言运行时、包管理器和 Git 能在同一项目中工作。', mechanism: '逐层 smoke test 把编辑器问题与运行时、依赖或路径问题分离。', steps: ['记录运行时与工具版本', '验证终端路径和 Git', '运行最小前后端项目'], misconception: '能打开编辑器就说明开发环境已完成', decision: '先跑版本与最小构建再开始项目', risk: '后续把环境错误误判为 AI 代码错误', concepts: ['运行时版本', '终端环境', '依赖管理', '启动验证'], practice: '制作 Java、Node、npm、Git 和编辑器五项环境检查表。', success: '每项有命令、期望输出和失败修复入口。',
  },
  {
    id: 'account-and-rules', unitId: 'setup-and-scaffold', title: '配置账号、规则与隐私边界', sourceLabel: '第3集 账户登录与个性化配置', sourceHash: '#doxcnjMrg5FzqtaUoyUOiHtyPIe', problem: '默认配置直接索引敏感目录，团队规则和格式化约定也没有提供给 AI', outcome: '能设置项目规则、忽略范围、模型权限和数据边界', insight: '个性化配置应优先表达工程规范和隐私边界，而不只是主题与快捷键。', mechanism: '规则文件和忽略列表为所有会话提供稳定约束，减少重复说明和意外读取。', steps: ['配置项目级规则', '排除密钥与生成目录', '按任务收紧自动执行权限'], misconception: '个人项目不存在隐私或权限风险', decision: '先建立忽略与权限清单再让 AI 扫描仓库', risk: '密钥、数据库或无关大文件进入上下文', concepts: ['项目规则', '忽略清单', '模型权限', '数据边界'], practice: '为一个全栈仓库写 AI 可读规则与禁止读取目录。', success: '规则覆盖技术栈、测试、格式、秘密和高风险命令。',
  },
  {
    id: 'scaffold-fullstack', unitId: 'setup-and-scaffold', title: '生成可运行而非空壳工程', sourceLabel: '第4集 一键生成 Spring Boot 与 Vue 3 项目结构', sourceHash: '#doxcnsfL3WG9n2S6idR7uaKvqrg', problem: 'AI 一次生成大量目录和代码，但依赖、接口和启动方式彼此不一致', outcome: '能把脚手架拆成后端、前端、契约和启动验证四步', insight: '脚手架的目标是最小垂直切片可运行，而不是目录看起来完整。', mechanism: '先让一个接口从数据库或模拟数据走到页面，再逐步扩展，能尽早暴露集成错误。', steps: ['确定版本和接口契约', '生成最小后端与前端', '启动并验证一条端到端路径'], misconception: '一次生成所有业务模块效率最高', decision: '先生成并跑通最小垂直切片', risk: '代码量巨大但没有任何端到端路径能运行', concepts: ['项目脚手架', '接口契约', '垂直切片', '启动验收'], practice: '规划 Spring Boot `/api/health` 到 Vue 状态页的最小切片。', success: '前后端可独立启动，页面能显示真实接口结果和错误状态。',
  },
  {
    id: 'next-edit-suggestion', unitId: 'everyday-coding', title: '驾驭智能预测而非盲接收', sourceLabel: '第1集 NES 智能预测与补全', sourceHash: '#doxcnszN1FGO2HUzIbR4tvM7Y2g', problem: '连续接受 AI 补全后代码看似顺畅，却悄悄改变了业务语义', outcome: '能快速判断补全的局部正确性、上下文一致性和测试需求', insight: '补全适合低风险局部模式，接受前仍需检查意图、类型、边界和副作用。', mechanism: '短建议依赖邻近上下文，越跨文件和业务边界越不应只靠自动接受。', steps: ['检查建议是否符合当前意图', '核对类型和副作用', '接受后运行最小验证'], misconception: '短补全风险很低，可以连续全部接受', decision: '先按影响范围决定接受、修改或拒绝', risk: '累积的小偏差形成难以定位的逻辑错误', concepts: ['局部补全', '意图一致', '副作用检查', '快速验证'], practice: '对五条补全建议分别做接受、修改或拒绝，并写理由。', success: '每次决定都能指出影响范围和验证方式。',
  },
  {
    id: 'inline-chat', unitId: 'everyday-coding', title: '用 Inline Chat 做局部可控修改', sourceLabel: '第2集 上下文内联对话 Inline Chat', sourceHash: '#doxcnCPyyfJDonBReEjtgFqKZmd', problem: '为了改一个函数把整个项目交给 Agent，结果无关文件也被修改', outcome: '能通过选区、约束和差异审查完成局部重构', insight: 'Inline Chat 的优势是上下文范围明确，适合解释、重写和生成局部测试。', mechanism: '选区限定修改面，指令补充不可变行为，diff 让接受前可核查。', steps: ['准确选择最小代码范围', '声明保持不变的行为', '逐块审查 diff 并测试'], misconception: '选中代码后无需说明任何上下文', decision: '先选区并写出局部验收标准', risk: '重构改变公开接口或异常行为', concepts: ['选区上下文', '局部指令', '差异审查', '行为保持'], practice: '用 Inline Chat 把一个长函数拆分，同时保持接口和测试不变。', success: 'diff 只触及必要范围，原测试与新增边界测试均通过。',
  },
  {
    id: 'project-context', unitId: 'everyday-coding', title: '主动提供项目上下文', sourceLabel: '第3集 Qoder 核心编辑器功能', sourceHash: '#doxcn679gdfSA7g4Z0JczTJSNub', problem: 'AI 根据当前文件做出修改，却不知道仓库内已有组件、接口和约定', outcome: '能从符号、引用、规则和相关文件构造最小上下文包', insight: '高质量上下文回答三个问题：当前任务受哪些接口约束、已有实现在哪里、怎样验收。', mechanism: '基于依赖关系选择上下文，比全仓库索引或只看当前文件更精确。', steps: ['从目标符号追踪依赖与调用者', '加入项目规则和相邻测试', '缺失时再渐进搜索'], misconception: '让编辑器自动索引全仓库就无需主动选上下文', decision: '先围绕一个决策选择证据文件', risk: '重复造轮子或破坏隐藏调用者', concepts: ['符号引用', '依赖关系', '项目规则', '渐进上下文'], practice: '为修改登录 DTO 选择后端、前端和测试上下文文件。', success: '上下文包含所有调用者与契约，但不加入无关模块。',
  },
  {
    id: 'prompt-for-code', unitId: 'agentic-workflow', title: '写出可执行的编码任务卡', sourceLabel: '第4集 AI 命令与提示词工程', sourceHash: '#doxcnsA6WtWsCgfWCIid3C39NVg', problem: '指令只有“帮我优化”，AI 大量改写却无法判断是否达标', outcome: '能写包含背景、目标、范围、约束、验收和测试的任务卡', insight: '编码提示词首先是任务规格，不是追求华丽措辞。', mechanism: '结构化任务卡减少模型猜测，也方便执行前审查和执行后验收。', steps: ['给出问题证据与目标', '限定文件范围和禁止项', '列出验收与测试命令'], misconception: '加入“你是世界级专家”比说明验收更重要', decision: '先写范围和验收再考虑表达优化', risk: 'AI 自行扩展范围或用表面改动宣布完成', concepts: ['任务背景', '范围约束', '验收标准', '测试命令'], practice: '为修复移动端横向滚动写一张完整任务卡。', success: '任务卡能让另一人独立执行并客观判断完成。',
  },
  {
    id: 'quality-gates', unitId: 'agentic-workflow', title: '给生成代码设置质量门禁', sourceLabel: '第5集 生成高质量全栈代码和质量评估', sourceHash: '#doxcn0FhpNt2biAVI9JnEVsbSEe', problem: '代码能启动就被合并，类型、测试、安全和响应式问题留到后面爆发', outcome: '能建立静态检查、测试、构建和人工审查的分层门禁', insight: 'AI 生成速度越快，质量门禁越要自动化并靠近修改发生的位置。', mechanism: '快速检查先拦截确定错误，集成和视觉验证再覆盖跨层行为。', steps: ['先运行格式、类型和单测', '再做集成与构建', '最后审查安全、可访问性和视觉'], misconception: '代码能运行一次就说明质量足够', decision: '先定义必须全绿的门禁再开始生成', risk: '局部演示成功但回归、漏洞和兼容性未被发现', concepts: ['静态检查', '自动测试', '构建门禁', '人工审查'], practice: '为全栈功能设计从提交前到发布前的门禁。', success: '每层有明确命令、失败责任和不可跳过条件。',
  },
  {
    id: 'agent-plan-execute', unitId: 'agentic-workflow', title: '让 Agent 先计划再跨文件执行', sourceLabel: '第1集 Agent 模式复杂任务流程', sourceHash: '#doxcna8LNs8R01fuafVHpcZaJIe', problem: 'Agent 未理解仓库就直接跨文件修改，做到一半才发现技术路线错误', outcome: '能审查 Agent 计划、控制权限并分阶段验收', insight: '复杂任务应经历侦察、计划、执行、验证和总结，计划必须能被证据推翻。', mechanism: '先读后写与阶段性检查减少错误扩散，并允许用户在高影响节点接管。', steps: ['只读侦察并列证据', '审查计划、范围和风险', '分批执行并在每批后验证'], misconception: 'Agent 的第一版计划一旦生成就不应改变', decision: '先批准基于仓库证据的最小计划', risk: '在错误假设上完成大量一致但无用的改动', concepts: ['只读侦察', '可修订计划', '分批执行', '阶段验收'], practice: '为添加导出功能设计三阶段 Agent 计划和每阶段门禁。', success: '任何新证据都能触发计划修订，且每批改动可独立回退。',
  },
  {
    id: 'quest-and-long-tasks', unitId: 'project-delivery', title: '管理长任务与 Quest', sourceLabel: '第2集 Quest 模式', sourceHash: '#doxcndAcMmEmnoz74sxmdt2lK1b', problem: '长任务跨多次会话，目标、进度和决策逐渐丢失', outcome: '能把长任务拆成有状态里程碑并保留恢复信息', insight: '长任务需要外部化计划、决策、完成证据和阻塞项，不能依赖单次聊天上下文。', mechanism: '里程碑和检查点让任务可以暂停、恢复和人工接管。', steps: ['定义里程碑与依赖', '每步保存改动和验证证据', '恢复时先校验最新状态'], misconception: '只要 Agent 持续运行足够久就能自然完成大项目', decision: '先把任务拆成可独立验收的里程碑', risk: '中断后重复副作用或忘记关键约束', concepts: ['长任务状态', '里程碑', '检查点', '恢复验证'], practice: '把电商项目拆成五个可独立演示和测试的里程碑。', success: '每个里程碑有输入、产物、测试和下一步条件。',
  },
  {
    id: 'git-and-debug', unitId: 'project-delivery', title: '用 Git 与调试形成证据链', sourceLabel: '第六章 企业级项目管理与最佳实践', sourceHash: '#doxcnFctnacfgnJTXI7LDvFT9Kg', problem: 'AI 修改很多文件后出现回归，却没有小提交、日志或可复现步骤', outcome: '能用分支、小提交、断点、日志和测试定位并回退问题', insight: 'Git 保存变更边界，调试工具保存运行证据；两者共同支撑 AI 改动审查。', mechanism: '小批次提交让二分定位和回滚可行，结构化调试避免继续靠猜。', steps: ['在独立分支小步提交', '复现并收集日志和变量', '修复后用回归测试证明'], misconception: 'AI 生成的改动可以最后一次性提交', decision: '先按可验证工作单元划分提交', risk: '无法区分哪次生成引入错误，也无法安全撤回', concepts: ['版本分支', '原子提交', '可复现调试', '回归证据'], practice: '为一次前后端 bug 修复规划三个原子提交。', success: '每个提交可构建、目的单一，并能独立回滚。',
  },
  {
    id: 'governance-and-mcp', unitId: 'project-delivery', title: '用规则、文档与 MCP 治理扩展', sourceLabel: '第七章 插件开发与高级集成', sourceHash: '#doxcnVzCN597noDWuKEwTntw8Mc', problem: '接入越来越多插件和 MCP 工具后，能力强了但权限、上下文和质量失控', outcome: '能用工具白名单、项目 Wiki、规则与验收治理 AI 开发环境', insight: '扩展能力必须同时扩展契约和治理：工具描述、最小权限、文档真相源和自动检查。', mechanism: '统一规则与可生成但可审查的项目文档，让人和 Agent 共享稳定上下文。', steps: ['只接入有明确价值的工具', '为每个工具定义权限与失败', '用 Wiki 和自动检查保持项目事实'], misconception: '插件和 MCP 越多，Agent 完成任务越快', decision: '先做价值、权限和维护成本评审', risk: '工具选择混乱、越权执行或文档与代码漂移', concepts: ['MCP 工具', '最小权限', '项目 Wiki', '自动治理'], practice: '为一个数据库 MCP 接入写权限矩阵和验收测试。', success: '默认只读，写操作有确认，文档与测试能验证工具行为。',
  },
]

export default defineCourseChapter({
  id: 'vibe-coding', title: 'Vibe Coding 全栈开发指南', shortTitle: 'Vibe Coding', order: 7, prerequisites: ['agent'],
  sourceId: 'vibe-coding-manual', sourceTitle: 'Vibe Coding 指南－AI 编辑器全栈开发', sourceUrl,
  units: [
    { id: 'ai-editor-foundations', title: '转变开发方式', stageIds: ['vibe-mindset', 'choose-the-mode', 'editor-workspace'] },
    { id: 'setup-and-scaffold', title: '环境与最小工程', stageIds: ['install-and-verify', 'account-and-rules', 'scaffold-fullstack'] },
    { id: 'everyday-coding', title: '日常 AI 编码技巧', stageIds: ['next-edit-suggestion', 'inline-chat', 'project-context'] },
    { id: 'agentic-workflow', title: 'Agent 化工作流', stageIds: ['prompt-for-code', 'quality-gates', 'agent-plan-execute'] },
    { id: 'project-delivery', title: '长任务与工程治理', stageIds: ['quest-and-long-tasks', 'git-and-debug', 'governance-and-mcp'] },
  ],
  stages,
  activities: vibeCodingActivities,
})
