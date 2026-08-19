import { defineCourseChapter, type CourseStageSeed } from '../factory'
import { langChainActivities } from './activities'

const sourceUrl = 'https://gcnum0i2ctpz.feishu.cn/docx/BlH2d5pigoVbKJxdoNIcYXvDnWe'

const stages: CourseStageSeed[] = [
  {
    id: 'langchain-role', unitId: 'chain-foundations', title: 'LangChain 负责哪一层', sourceLabel: '1. LangChain 是什么？', sourceHash: '#doxcnHeFX6C79W1xKL8i4YNKfuh', problem: '项目把模型调用、提示词、工具和记忆散落在业务代码里，难以组合与测试', outcome: '能说明 LangChain 的抽象价值并判断何时不必引入框架', insight: 'LangChain 提供模型、消息、提示词、工具和执行组件的统一接口，重点是组合而非替代业务设计。', mechanism: '标准接口让组件可替换、可追踪和可测试，但框架不能自动解决数据与产品边界。', steps: ['画出当前调用链', '识别需要替换或复用的组件', '只引入有价值的抽象'], misconception: '使用 LangChain 就自动得到可靠 Agent', decision: '先确认组合复杂度是否值得引入框架', risk: '为简单的一次模型调用增加不必要依赖', concepts: ['组件抽象', '可组合链路', '业务边界', '框架选型'], practice: '比较直接 SDK 调用和 LangChain 组合在一个三步任务中的差异。', success: '能明确列出引入框架带来的复用收益与额外复杂度。',
  },
  {
    id: 'environment-and-model', unitId: 'chain-foundations', title: '搭建可验证的模型入口', sourceLabel: '2. 环境搭建', sourceHash: '#doxcnjOa89fNc1HBsTo5zrI2ilc', problem: '依赖和密钥配置散乱，环境一换就无法运行或泄露凭据', outcome: '能建立最小环境、密钥隔离和启动验证', insight: '环境搭建的完成标准不是安装成功，而是能用最小请求验证模型、超时和错误处理。', mechanism: '依赖锁定与环境变量隔离让本地、测试和部署环境行为一致。', steps: ['锁定依赖版本', '从环境读取密钥', '用最小请求验证成功与失败'], misconception: '把 API Key 写进示例代码最省事', decision: '先建立不进入源码的配置入口', risk: '密钥进入仓库或环境差异导致不可复现', concepts: ['依赖锁定', '密钥隔离', '模型客户端', '启动验证'], practice: '写一个只返回模型元信息的最小健康检查，不打印密钥。', success: '缺密钥、网络失败和请求成功都有明确结果，日志不含敏感值。',
  },
  {
    id: 'core-concepts-map', unitId: 'chain-foundations', title: '建立组件概念地图', sourceLabel: '3. 核心概念速览', sourceHash: '#doxcn5eal8G0Yqzx5zlISXh3oYc', problem: 'Prompt、Model、Tool、Agent、Memory 等名词混用，导致职责重叠', outcome: '能为每个核心组件定义输入、输出和所有者', insight: '先把组件看成数据流节点：提示词组织消息，模型决策，工具执行，状态保存过程。', mechanism: '清晰契约让问题能定位到组件，而不是把所有行为塞进 Agent。', steps: ['列出组件输入输出', '标记纯函数与有副作用组件', '定义组合和错误边界'], misconception: 'Chain 和 Agent 只是两种叫法，行为完全相同', decision: '先按是否需要模型动态决策区分 Chain 与 Agent', risk: '不可预测组件被放进必须确定执行的业务步骤', concepts: ['Prompt', 'Model', 'Tool', 'Agent 状态'], practice: '为“查天气并生成出行建议”画出组件和数据流。', success: '每个节点只承担一种职责，工具副作用和 Agent 决策边界清楚。',
  },
  {
    id: 'prompt-template', unitId: 'prompts-and-messages', title: '把提示词变成可测试模板', sourceLabel: '4.1 最简单的模板', sourceHash: '#doxcnhVtIrcp4YIVgWMCrH8po3b', problem: '业务代码到处拼接字符串，变量缺失和格式变化直到运行时才发现', outcome: '能定义输入变量明确、可单测的 PromptTemplate', insight: '模板把固定指令与运行时变量分离，使渲染结果可预览、可测试。', mechanism: '显式变量契约减少隐式字符串依赖，也便于版本化和对比评估。', steps: ['定义模板职责和变量', '渲染并检查边界输入', '用固定样例做快照测试'], misconception: '模板越长越能保证模型听话', decision: '先写输入契约与期望输出，再写模板', risk: '变量缺失、注入或格式漂移导致行为不稳定', concepts: ['模板变量', '渲染结果', '输入契约', '版本化提示'], practice: '把一段包含用户主题和语气的字符串拼接改为模板。', success: '变量缺失会明确失败，三个输入样例渲染结果可检查。',
  },
  {
    id: 'chat-messages', unitId: 'prompts-and-messages', title: '正确组织聊天消息', sourceLabel: '4.2 聊天模板（常用）', sourceHash: '#doxcnXeVY8318GWCASc7PUbMSab', problem: '系统规则、用户输入和历史消息混成一个字符串，角色边界失效', outcome: '能用 System、Human、AI 消息构造清晰上下文', insight: '聊天模板保留消息角色，系统规则、用户请求和历史内容不应互相伪装。', mechanism: '角色结构帮助模型区分长期指令、当前任务和先前输出，也便于裁剪历史。', steps: ['固定系统消息', '把用户数据放入 Human 消息', '按策略选择历史消息'], misconception: '把所有内容放进 System 消息最安全', decision: '先按内容所有者和可信度分配角色', risk: '用户输入被当成系统规则或历史噪声淹没当前任务', concepts: ['消息角色', '系统规则', '用户输入', '历史裁剪'], practice: '把客服对话拆成系统政策、用户问题和两轮历史。', success: '不可信用户文本不会进入系统规则，历史可独立裁剪。',
  },
  {
    id: 'few-shot-and-dynamic', unitId: 'prompts-and-messages', title: '用少样本与动态上下文示范行为', sourceLabel: '4.3 Few-shot 示例模板', sourceHash: '#doxcnQysv6H7xeD2uT93MrLtAYe', problem: '仅靠抽象规则难以让模型稳定遵守分类格式和边界样例', outcome: '能挑选少量有代表性的示例而不过度拟合', insight: 'Few-shot 用输入输出示例展示任务边界；示例质量和覆盖比数量更重要。', mechanism: '模型从模式中学习格式和决策边界，但相似错误示例也会放大偏差。', steps: ['覆盖正常与边界案例', '保持示例格式一致', '在留出集上评估'], misconception: '把历史中的成功输出全部塞进去效果最好', decision: '先选择互补且经过验证的少量示例', risk: '示例偏见、上下文膨胀或泄露用户数据', concepts: ['少样本示范', '边界覆盖', '示例选择', '上下文成本'], practice: '为三分类任务挑选四个互补示例并说明各自覆盖的边界。', success: '示例无重复、格式一致，且在未见样例上验证。',
  },
  {
    id: 'tool-contract', unitId: 'tools', title: '把函数变成可靠工具契约', sourceLabel: '5.1 用装饰器定义工具', sourceHash: '#doxcnUx1452s6eOOqm8eI0WF7Mc', problem: '模型看到工具名却不理解何时调用、参数含义和返回格式', outcome: '能写出名称、描述、参数 schema 和错误清晰的工具', insight: '工具描述是给模型的 API 文档，参数 schema 是执行边界，两者同样重要。', mechanism: '明确的语义与类型减少选错工具和构造非法参数。', steps: ['用动词命名单一职责', '定义严格参数和约束', '返回结构化结果或明确错误'], misconception: '函数能被调用就已经是一个好工具', decision: '先从模型视角审查工具名称、描述和参数', risk: '工具选择正确但参数含义错误，造成副作用', concepts: ['工具描述', '参数 Schema', '结构化返回', '错误契约'], practice: '把“查询订单”函数改造成只读工具，并定义不存在订单的返回。', success: '模型无需猜测参数，错误不会伪装成正常结果。',
  },
  {
    id: 'tool-validation', unitId: 'tools', title: '验证参数并控制副作用', sourceLabel: '5.2 更复杂的工具', sourceHash: '#doxcnrVEDyi67kpGxPIRpcZtpee', problem: '工具接受任意字符串和金额，模型一次错误参数就可能写坏业务数据', outcome: '能为复杂工具加入验证、幂等和权限确认', insight: '模型输出不可信，工具边界必须像公开 API 一样验证所有输入。', mechanism: '类型、范围、幂等键和授权把错误限制在执行前或可恢复范围。', steps: ['校验类型、范围与业务状态', '区分读取与写入工具', '写入使用幂等键和确认'], misconception: '模型通过 schema 生成的参数可以直接信任', decision: '先按外部输入标准验证再执行', risk: '重复扣款、越权查询或不可逆写入', concepts: ['输入验证', '幂等', '权限确认', '副作用隔离'], practice: '为退款工具设计金额、订单状态、权限和重复请求校验。', success: '非法与重复请求都在副作用发生前被拦截。',
  },
  {
    id: 'bind-tools', unitId: 'tools', title: '理解模型绑定与执行分离', sourceLabel: '5.4 把工具绑定到模型', sourceHash: '#doxcnv3FjdhXM1Y3ZoMIUwsjZdb', problem: '以为 bind_tools 会自动执行函数，结果应用只得到一段工具调用请求', outcome: '能区分模型选择工具、应用执行工具和结果回传', insight: '绑定工具只是向模型声明可用能力；宿主程序仍要验证、执行并把结果作为消息返回。', mechanism: '选择与执行分离能在副作用前加权限、日志和重试。', steps: ['向模型暴露工具 schema', '解析并验证调用请求', '执行后回传工具结果'], misconception: '模型可以直接在服务器里运行任意绑定函数', decision: '先建立工具调用分发器与安全层', risk: '忽略执行循环，或绕过权限直接运行参数', concepts: ['工具绑定', '调用请求', '宿主执行', '结果消息'], practice: '画出一次搜索工具调用从模型到执行再回到模型的消息序列。', success: '清楚标出模型不能直接执行函数以及校验发生的位置。',
  },
  {
    id: 'agent-loop', unitId: 'agents', title: '读懂 Agent 决策循环', sourceLabel: '6. Agent 智能代理', sourceHash: '#doxcnqy1Y2dlcsc9e9jrztrZCDg', problem: '多工具任务出现无限循环或提前结束，却不知道 Agent 如何决定下一步', outcome: '能解释模型决策、工具执行、观察与停止循环', insight: 'Agent 是让模型在状态和工具之间反复决策的执行循环，不是单次模型调用。', mechanism: '每次观察成为下一轮上下文，停止条件与最大步数限制循环风险。', steps: ['模型根据状态选择动作', '宿主执行并记录观察', '检查停止或继续条件'], misconception: 'Agent 会天然知道任务何时真正完成', decision: '先定义最大步数、成功证据和停止条件', risk: '循环调用昂贵工具或无证据地宣布完成', concepts: ['决策循环', '工具观察', '停止条件', '步数预算'], practice: '为查天气再推荐衣物画出至少两轮 Agent 轨迹。', success: '每轮动作都有观察，结束由可验证条件触发。',
  },
  {
    id: 'multi-intent-agent', unitId: 'agents', title: '处理多问题与任务分解', sourceLabel: '6.2 Agent 处理多个问题', sourceHash: '#doxcnvmC2nAm41tfctu3IpzAtQc', problem: '用户一次问多个问题，Agent 漏答、重复调用或把不同实体混在一起', outcome: '能拆分子任务并追踪每项完成状态', insight: '多意图任务需要显式任务列表和结果汇总，不能只依赖连续思考文本。', mechanism: '子任务状态让工具调用、失败和最终答案可以逐项对齐。', steps: ['识别并编号子任务', '为每项选择工具和验收', '汇总并标注未完成项'], misconception: '让 Agent 自由思考就会自动覆盖所有问题', decision: '先生成可审查的子任务清单', risk: '部分问题未完成却返回整体成功', concepts: ['意图拆分', '子任务状态', '逐项验收', '结果汇总'], practice: '把“查两城天气、比较并订票”拆成依赖明确的子任务。', success: '每个子任务都有输入、完成证据和失败状态。',
  },
  {
    id: 'agent-memory', unitId: 'agents', title: '给 Agent 恰当的记忆', sourceLabel: '6.3 带记忆的 Agent', sourceHash: '#doxcn9mqb2nXcZQHTIBD8RWnQYc', problem: '完整历史越积越长，模型既贵又把旧信息当成当前事实', outcome: '能区分短期会话状态、长期用户事实和外部知识', insight: '记忆不是无限聊天记录，而是按生命周期和可信度选择需要保留的信息。', mechanism: '短期状态服务当前任务，长期事实需显式确认，知识则应通过检索获得。', steps: ['按生命周期分类信息', '只持久化明确且必要的事实', '检索或摘要后注入当前上下文'], misconception: '把全部历史消息永久保存就是最完整的记忆', decision: '先定义记忆类型、保留期和用户可控性', risk: '过期事实污染决策或泄露不必要数据', concepts: ['会话状态', '长期记忆', '知识检索', '生命周期'], practice: '把十条对话信息分成不保存、会话内、长期事实和知识库四类。', success: '每类都有保留理由、过期策略和删除入口。',
  },
  {
    id: 'streaming', unitId: 'ship-an-assistant', title: '正确处理流式输出', sourceLabel: '6.4 流式输出', sourceHash: '#doxcnjh4uIVXibIxc2DCY8pqc8g', problem: '流式界面看起来更快，却把半截工具调用或错误答案直接展示给用户', outcome: '能区分文本 token、工具事件和最终完成状态', insight: '流式输出是事件流，不只是逐字打印；不同事件必须有不同 UI 与提交语义。', mechanism: '把中间事件和最终结果分离，才能支持取消、错误恢复和工具进度。', steps: ['定义事件类型', '增量显示可公开内容', '完成后提交最终状态'], misconception: '收到第一个 token 就代表请求已经成功', decision: '先设计流协议和取消语义', risk: '中途失败留下看似完整但未验证的答案', concepts: ['事件流', '增量渲染', '取消', '最终提交'], practice: '设计 text_delta、tool_start、tool_result、complete、error 五类事件。', success: '失败不会被标记完成，工具参数和敏感中间信息不直接展示。',
  },
  {
    id: 'assistant-project', unitId: 'ship-an-assistant', title: '组装全能助手最小项目', sourceLabel: '7. 完整项目：全能智能助手', sourceHash: '#doxcnHnzXSxPxSliFzBVjMcWKqg', problem: '提示词、工具、Agent 和 UI 分别能跑，但组合后没有统一错误与测试路径', outcome: '能按模块组装可运行、可测试的助手项目', insight: '项目应把工具、Agent 构建、配置和入口分离，并让每层可独立测试。', mechanism: '模块边界减少隐藏全局状态，依赖注入让模型和工具可替换成测试双。', steps: ['分离配置、工具和 Agent 构建', '建立统一调用入口', '用模拟模型和工具做集成测试'], misconception: '所有代码写在一个 main.py 最方便理解和部署', decision: '先按变化原因拆模块再连接', risk: '测试必须调用真实模型和外部服务，导致缓慢不稳定', concepts: ['模块边界', '依赖注入', '统一入口', '测试替身'], practice: '按 config、tools、agent、app、tests 规划项目结构。', success: '核心流程可在不调用真实 API 的情况下完成集成测试。',
  },
  {
    id: 'langchain-production', unitId: 'ship-an-assistant', title: '把链路带到生产环境', sourceLabel: '8. 进阶技巧与最佳实践', sourceHash: '#doxcnCnmY09CL6WHZQzNoFdSand', problem: 'Demo 可用，但上线后遇到超时、限流、成本、追踪和版本升级问题', outcome: '能建立生产级超时、重试、追踪、评估和版本管理', insight: '生产化重点不是再加组件，而是让每次调用有预算、可观测、可回归和可降级。', mechanism: '统一运行配置和评估集让模型、Prompt 或框架升级可被安全比较。', steps: ['设置超时、重试和预算', '记录结构化轨迹与指标', '用固定评估集做升级门禁'], misconception: '框架版本升级只要代码能编译就可以发布', decision: '先建立行为回归与成本门禁', risk: '隐式默认值变化导致质量或费用突然漂移', concepts: ['运行预算', '可观测性', '行为评估', '版本门禁'], practice: '为一次 LangChain 升级写发布检查表。', success: '检查覆盖接口兼容、质量、延迟、成本、错误和回滚。',
  },
]

export default defineCourseChapter({
  id: 'langchain', title: 'LangChain 从入门到实战', shortTitle: 'LangChain', order: 5, prerequisites: ['agent', 'rag'],
  sourceId: 'langchain-manual', sourceTitle: 'LangChain 实战教程：从入门到实战', sourceUrl,
  units: [
    { id: 'chain-foundations', title: '认识框架与组件', stageIds: ['langchain-role', 'environment-and-model', 'core-concepts-map'] },
    { id: 'prompts-and-messages', title: '提示词与消息', stageIds: ['prompt-template', 'chat-messages', 'few-shot-and-dynamic'] },
    { id: 'tools', title: '工具契约与执行', stageIds: ['tool-contract', 'tool-validation', 'bind-tools'] },
    { id: 'agents', title: 'Agent、任务与记忆', stageIds: ['agent-loop', 'multi-intent-agent', 'agent-memory'] },
    { id: 'ship-an-assistant', title: '交付一个可靠助手', stageIds: ['streaming', 'assistant-project', 'langchain-production'] },
  ],
  stages,
  activities: langChainActivities,
})
