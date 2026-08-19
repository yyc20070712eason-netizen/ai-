import { defineCourseChapter, type CourseStageSeed } from '../factory'
import { langGraphActivities } from './activities'

const sourceUrl = 'https://gcnum0i2ctpz.feishu.cn/docx/WejIdYMHCoDCj6xlnwQcHyWmnNc'

const stages: CourseStageSeed[] = [
  {
    id: 'why-langgraph', unitId: 'graph-foundations', title: '为什么复杂 Agent 需要图', sourceLabel: '第一章 LangGraph 是什么', sourceHash: '#doxcnpAKguJQWPgCFQzAJhi7m5f', problem: 'Agent 需要分支、循环、暂停和恢复，普通线性调用越来越难维护', outcome: '能判断何时使用 LangGraph 而不是简单 Chain', insight: 'LangGraph 用状态图显式表达节点、边和循环，适合长运行、可恢复的 Agent 工作流。', mechanism: '控制流从隐含提示词变成可检查的图结构，状态则成为节点之间的契约。', steps: ['识别任务是否有分支循环', '画出状态与控制流', '再决定是否引入图'], misconception: '任何一次模型调用都应该放进 LangGraph', decision: '先用流程复杂度和恢复需求判断框架', risk: '简单任务被过度建模，复杂任务却仍隐藏在一个节点里', concepts: ['状态图', '显式控制流', '长运行任务', '框架边界'], practice: '比较 FAQ 问答和带人工审批的退款流程，判断哪个需要图。', success: '选择依据包含分支、循环、持久化和人工接管。',
  },
  {
    id: 'langgraph-vs-langchain', unitId: 'graph-foundations', title: '区分 LangGraph 与 LangChain', sourceLabel: 'LangGraph vs LangChain', sourceHash: '#doxcnIXeiSkpfE8eQMkm99X8Ycg', problem: '团队把两者当作互斥框架，选型争论停留在品牌而非职责', outcome: '能说明组件层与编排层如何配合', insight: 'LangChain 提供模型、工具等组件抽象，LangGraph 侧重有状态控制流；它们可以组合使用。', mechanism: '组件负责能力，图负责这些能力在何种状态和条件下运行。', steps: ['列出可复用能力组件', '单独设计状态与流转', '按接口组合而非耦合'], misconception: '用了 LangGraph 就不能再用 LangChain 工具', decision: '先按能力与编排两层拆分需求', risk: '把全部业务逻辑塞进图框架或单一 Agent', concepts: ['能力组件', '状态编排', '接口组合', '职责分层'], practice: '为客服 Agent 标出哪些属于工具组件、哪些属于图控制流。', success: '同一图可以替换模型或工具而不重写路由。',
  },
  {
    id: 'environment-smoke-test', unitId: 'graph-foundations', title: '搭建可重复的运行环境', sourceLabel: '第二章 环境准备', sourceHash: '#doxcnmYth2gVkpTeMJhChKYWzEg', problem: '示例在作者环境能跑，本机因依赖、密钥或版本差异失败', outcome: '能锁定依赖并用最小图完成启动验证', insight: '环境完成的证据是一张最小图可编译、可调用、失败可解释，而不是安装命令无报错。', mechanism: '最小 smoke test 快速隔离框架安装、模型配置与业务图逻辑。', steps: ['锁定 Python 与包版本', '隔离密钥配置', '运行无副作用最小图'], misconception: '只要 import 成功，运行环境就验证完毕', decision: '先让常量节点图通过再接模型', risk: '把环境问题误判成图状态或模型问题', concepts: ['依赖锁定', '密钥隔离', '图编译', '启动验证'], practice: '创建 START→hello→END 的最小图并记录版本。', success: '无模型 API 时也能验证图编译和状态返回。',
  },
  {
    id: 'state-schema', unitId: 'state-and-nodes', title: '把 State 设计成数据契约', sourceLabel: 'State（状态）', sourceHash: '#doxcnf44uhGmqRjbB5gQna0uhrh', problem: '节点随意读写字典字段，运行到中途才发现字段缺失或语义冲突', outcome: '能定义最小、类型明确、生命周期清晰的状态 schema', insight: 'State 是整张图共享的数据契约，只应包含跨节点需要的事实。', mechanism: '显式类型与字段所有权让节点可独立测试，也为持久化和迁移提供基础。', steps: ['列出跨节点共享数据', '定义类型与默认值', '标记谁写入、谁读取'], misconception: '把所有临时变量都放入全局 State 最方便', decision: '先删除不需要跨节点传播的字段', risk: '状态膨胀、字段覆盖和敏感数据长期保留', concepts: ['状态 Schema', '字段所有权', '生命周期', '跨节点契约'], practice: '为写作审核图设计 topic、draft、feedback、status 四类状态。', success: '每个字段都有类型、写入节点和清理时机。',
  },
  {
    id: 'node-contracts', unitId: 'state-and-nodes', title: '让 Node 保持单一职责', sourceLabel: 'Node（节点）', sourceHash: '#doxcn6im4lM8RGGcYXnPw6idsXg', problem: '一个节点同时调用模型、写数据库、决定路由和格式化输出，无法测试', outcome: '能把节点设计为接收状态并返回局部更新的清晰函数', insight: '好节点只完成一个可描述动作，并返回需要合并的状态更新。', mechanism: '小节点使失败定位、重试策略和测试替身都更简单。', steps: ['定义节点输入字段', '只做一个动作', '返回最小状态增量'], misconception: '节点越大图就越简单，因此更易维护', decision: '先按失败和重试边界拆节点', risk: '重试一个节点重复执行数据库副作用', concepts: ['单一职责', '状态增量', '失败边界', '节点测试'], practice: '把“检索并生成并保存”拆成三个节点。', success: '每个节点可独立测试，写入副作用不会因模型重试重复。',
  },
  {
    id: 'edges-and-boundaries', unitId: 'state-and-nodes', title: '用 Edge 表达确定流程', sourceLabel: 'Edge（边）', sourceHash: '#doxcnCi0KFhgiz3VbF0aB4IsLtb', problem: '流程跳转隐藏在节点内部 if 语句里，图看起来直线但行为并不直线', outcome: '能把固定顺序与条件路由分别放到合适的边', insight: '普通边表达确定下一步，条件边根据状态选择路径；路由规则应尽量纯净。', mechanism: '把控制流外显后，图结构与真实运行路径一致，便于验证所有分支。', steps: ['提取节点内部路由逻辑', '区分固定和条件边', '验证所有返回值都有目标'], misconception: '路由写在节点里更灵活，不影响可观测性', decision: '先让节点产生事实，再由边根据事实路由', risk: '出现未覆盖分支或图结构与运行行为不一致', concepts: ['普通边', '条件边', '路由函数', '控制流边界'], practice: '把审核通过/退回/升级三个分支画成条件边。', success: '每个可能路由值都有唯一目标和测试样例。',
  },
  {
    id: 'compile-first-graph', unitId: 'control-flow', title: '编译并运行第一张图', sourceLabel: '第四章 第一个程序', sourceHash: '#doxcn1QP6Q9ZdJGFIcqi1ZwmCGg', problem: '会写节点和边，却忽略 START、END 与编译检查，运行时路径不完整', outcome: '能从状态定义到编译和 invoke 跑通最小图', insight: '构图阶段声明结构，compile 阶段验证并生成可运行对象，invoke 才执行一次状态流。', mechanism: '分离声明与执行让框架在运行前发现部分结构错误。', steps: ['创建 StateGraph 并注册节点', '连接 START、节点和 END', '编译后用固定输入调用'], misconception: '添加节点后无需边也会按声明顺序自动执行', decision: '先用最小输入检查实际输出状态', risk: '图存在不可达节点或没有终止路径', concepts: ['START', 'END', '编译', '图调用'], practice: '构建 input→normalize→END 图并打印最终状态。', success: '图可编译，路径唯一，输出只包含声明字段。',
    codeTitle: '最小图结构', code: `builder = StateGraph(State)\nbuilder.add_node("normalize", normalize)\nbuilder.add_edge(START, "normalize")\nbuilder.add_edge("normalize", END)\ngraph = builder.compile()`,
  },
  {
    id: 'reducers', unitId: 'control-flow', title: '用 Reducer 合并并发与累积状态', sourceLabel: '第五章 Reducer 机制', sourceHash: '#doxcnNVlxArDjpsdFXiOU4PxV2e', problem: '多个节点更新同一列表时后写覆盖前写，历史消息或结果丢失', outcome: '能判断字段应该覆盖、累加还是自定义合并', insight: 'Reducer 定义同一状态字段收到多个更新时如何合并，而不是默认覆盖。', mechanism: '明确合并语义让并行分支、消息累积和计数器行为可预测。', steps: ['为每个共享字段选择合并语义', '保证 reducer 尽量纯函数', '测试顺序与重复更新'], misconception: '所有列表字段都应该简单相加', decision: '先按业务语义选择覆盖、追加或去重', risk: '状态重复、丢失或因非幂等合并不断膨胀', concepts: ['Reducer', '状态合并', '并行更新', '幂等语义'], practice: '为 messages、score、latest_answer 选择不同 reducer。', success: '三字段分别体现追加、累加和覆盖且测试通过。',
  },
  {
    id: 'conditional-routing', unitId: 'control-flow', title: '设计可测试的条件分支', sourceLabel: '第六章 条件分支', sourceHash: '#doxcnlYDHsNPBFytqsjUBwkkqNe', problem: '智能客服路由由模型自由输出任意文本，偶尔返回未知类别导致图中断', outcome: '能用有限路由标签、默认分支和置信度控制条件边', insight: '路由输出应是有限枚举，并为低置信和未知结果设计安全兜底。', mechanism: '收紧路由契约能把开放式模型输出转换为可验证控制信号。', steps: ['定义有限路由枚举', '校验模型输出和置信度', '设置默认或人工分支'], misconception: '让路由模型返回自然语言最灵活', decision: '先把业务路径定义成枚举再让模型分类', risk: '未知输出没有目标边或高风险请求走错分支', concepts: ['条件边', '路由枚举', '置信度', '安全兜底'], practice: '为售前、售后、投诉和人工设计客服路由。', success: '所有输入都落到已知路径，低置信必进人工。',
  },
  {
    id: 'controlled-loops', unitId: 'control-flow', title: '让循环有预算和退出证据', sourceLabel: '第七章 循环流程', sourceHash: '#doxcnr23leY1UhBeHj9icdKLenb', problem: '答案优化器不断自评和重写，成本上涨却没有明确变好', outcome: '能设计迭代计数、质量阈值和最大步数', insight: '循环必须有可观察进展、退出条件和硬预算，否则只是无限重试。', mechanism: '状态中的 iteration、score 和 last_error 让路由依据证据停止或继续。', steps: ['定义每轮可测改进目标', '记录次数和分数', '满足阈值或预算时退出'], misconception: '让模型自己决定是否满意就足以停止', decision: '先设硬上限和外部质量信号', risk: '循环震荡、费用失控或永不结束', concepts: ['迭代状态', '质量阈值', '最大步数', '终止证据'], practice: '为最多三轮的答案改写图设计 continue、accept、fallback 路由。', success: '任何路径都在预算内终止，且保留最佳版本。',
  },
  {
    id: 'messages-state', unitId: 'messages-and-tools', title: '正确累积聊天消息', sourceLabel: 'MessagesState 和 add_messages', sourceHash: '#doxcn8unJwBl5GkAQ7SfNSNhMAd', problem: '聊天图手动拼接消息造成重复、覆盖或工具消息顺序错误', outcome: '能使用消息 reducer 保持对话与工具调用结构', insight: 'MessagesState 让消息按标识合并，add_messages 处理追加与更新语义。', mechanism: '结构化消息保留角色、工具调用 ID 和结果对应关系。', steps: ['使用消息专用状态', '节点只返回新增或更新消息', '测试工具调用顺序'], misconception: '消息就是字符串列表，直接相加没有差别', decision: '先保持消息对象和调用 ID 完整', risk: '工具结果无法对应调用或同一消息重复出现', concepts: ['MessagesState', 'add_messages', '消息标识', '工具消息'], practice: '构造 Human→AI tool call→Tool result→AI answer 的消息序列。', success: '工具结果与调用 ID 一一对应，重复更新不会追加副本。',
  },
  {
    id: 'chatbot-graph', unitId: 'messages-and-tools', title: '构建可持续对话图', sourceLabel: '第八章 聊天机器人', sourceHash: '#doxcnPZs51811bMfsxiy1uYk3zh', problem: '聊天机器人每轮都从零开始或把无限历史全部发送给模型', outcome: '能把消息状态、模型节点和历史裁剪组合成聊天图', insight: '聊天图的关键是状态生命周期与上下文选择，而不只是调用聊天模型。', mechanism: '持久状态保存对话事实，模型输入则按窗口和任务裁剪。', steps: ['定义会话线程标识', '保存结构化消息状态', '调用前裁剪或摘要'], misconception: '保存状态就必须把全部历史传给模型', decision: '先区分持久记录与当前上下文', risk: '上下文无限增长或多个用户会话串线', concepts: ['会话线程', '消息持久化', '上下文裁剪', '隔离边界'], practice: '为两个用户各两轮对话设计 thread_id 与历史加载流程。', success: '会话不串线，模型只收到当前任务必要历史。',
  },
  {
    id: 'tool-node', unitId: 'messages-and-tools', title: '把工具调用接入图', sourceLabel: '第九章 Agent 工具调用', sourceHash: '#doxcnB4Pb6JRGhInTK77sPWlf6f', problem: '模型生成工具请求后，图不知道如何执行、记录结果并回到模型', outcome: '能连接模型节点、工具节点和是否调用工具的条件边', insight: '工具循环通常由模型节点决定动作，ToolNode 执行，条件边把结果送回模型。', mechanism: '执行节点集中处理工具映射、错误和消息格式，使图控制流清晰。', steps: ['为模型绑定有限工具', '路由工具调用到执行节点', '结果消息回到模型并检查停止'], misconception: '工具节点应该自己决定调用哪个工具', decision: '先把决策、执行和停止拆开', risk: '工具异常被当作正常观察，模型继续错误决策', concepts: ['模型节点', 'ToolNode', '工具路由', '错误观察'], practice: '画出天气工具的模型→工具→模型循环，并加入错误分支。', success: '工具失败能被结构化记录且不会无限重试。',
  },
  {
    id: 'react-graph', unitId: 'reliable-agents', title: '用图实现 ReAct Agent', sourceLabel: '第十章 ReAct Agent', sourceHash: '#doxcnDfhDca380gWIgUqOkUzAdd', problem: 'ReAct 只存在于模型思维文本中，工具轨迹和停止条件不可控', outcome: '能把 ReAct 的决策与行动循环映射成显式图', insight: '图中的模型节点负责 Action 决策，工具节点产生 Observation，条件边决定继续或结束。', mechanism: '显式状态和边让每一步可记录、限步和恢复，而无需暴露隐藏推理文本。', steps: ['保存动作与观察的结构化状态', '执行工具并回传结果', '按证据和预算停止'], misconception: '可靠 ReAct 必须展示模型完整思维链', decision: '先记录可审计动作与观察，不保存私有推理', risk: '循环不可观测或泄露不必要的内部推理', concepts: ['ReAct 循环', '动作记录', '工具观察', '停止预算'], practice: '为查汇率并换算金额设计两节点 ReAct 图。', success: '轨迹含动作、参数、结果和停止证据，不依赖展示思维链。',
  },
  {
    id: 'persistence-and-resume', unitId: 'reliable-agents', title: '用检查点恢复长任务', sourceLabel: 'ReAct Agent 工作流程', sourceHash: '#doxcn7EUsiHTrMHNLlcjAS67fKc', problem: '进程重启或用户离开后，长任务只能从头执行并重复副作用', outcome: '能按 thread_id 保存检查点并从正确状态恢复', insight: 'Checkpointer 把图状态按线程和步骤持久化，恢复时应先验证外部世界是否仍一致。', mechanism: '状态快照解决进程内记忆丢失，幂等和版本校验解决外部副作用变化。', steps: ['为运行分配稳定 thread_id', '在关键边界保存检查点', '恢复前校验状态与外部资源'], misconception: '有检查点就可以安全重放任何节点', decision: '先为副作用节点设计幂等或补偿', risk: '恢复时重复发送、扣款或写入', concepts: ['检查点', 'thread_id', '幂等恢复', '状态版本'], practice: '为审批后发送邮件的图设计中断和恢复流程。', success: '重复恢复不会重复发信，过期审批会被重新确认。',
  },
  {
    id: 'interrupt-and-production', unitId: 'reliable-agents', title: '加入人工中断与生产护栏', sourceLabel: 'LangGraph 实战教程', sourceHash: '#doxcn1r4vuQ9H2ptFOeKbrS7pfh', problem: '图能运行，但高风险节点没有人工批准，版本升级也没有回归和追踪', outcome: '能把 interrupt、权限、追踪、评估和回滚组成发布门禁', insight: '生产图必须在高影响动作前可中断，把状态和决策包交给人，再从已确认位置继续。', mechanism: '人工接管配合检查点、结构化轨迹和固定评估集，才能安全演进。', steps: ['标出高影响节点并设置 interrupt', '展示选项证据和副作用', '批准后恢复并记录结果'], misconception: '只要图有确定边就不需要人工审批', decision: '先按影响与可逆性设置中断点', risk: '自动流程在错误状态下完成不可逆动作', concepts: ['人工中断', '决策包', '运行追踪', '发布门禁'], practice: '为自动退款图设计人工批准界面所需字段和恢复条件。', success: '用户看到金额、依据和副作用；拒绝或超时都有安全路径。',
  },
]

export default defineCourseChapter({
  id: 'langgraph', title: 'LangGraph 从入门到实战', shortTitle: 'LangGraph', order: 6, prerequisites: ['agent', 'langchain'],
  sourceId: 'langgraph-manual', sourceTitle: 'LangGraph 实战教程：从小白到高手', sourceUrl,
  units: [
    { id: 'graph-foundations', title: '理解图式 Agent', stageIds: ['why-langgraph', 'langgraph-vs-langchain', 'environment-smoke-test'] },
    { id: 'state-and-nodes', title: '状态、节点与边', stageIds: ['state-schema', 'node-contracts', 'edges-and-boundaries'] },
    { id: 'control-flow', title: '控制流与状态合并', stageIds: ['compile-first-graph', 'reducers', 'conditional-routing', 'controlled-loops'] },
    { id: 'messages-and-tools', title: '消息与工具循环', stageIds: ['messages-state', 'chatbot-graph', 'tool-node'] },
    { id: 'reliable-agents', title: '可靠 ReAct 与恢复', stageIds: ['react-graph', 'persistence-and-resume', 'interrupt-and-production'] },
  ],
  stages,
  activities: langGraphActivities,
})
