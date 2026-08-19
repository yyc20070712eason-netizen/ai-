import { defineCourseChapter, type CourseStageSeed } from '../factory'
import { ragActivities } from './activities'

const sourceUrl = 'https://gcnum0i2ctpz.feishu.cn/docx/AkL6dtK5EoQ32YxlTmEcbNRInqe'

const stages: CourseStageSeed[] = [
  {
    id: 'rag-why', unitId: 'rag-foundations', title: '为什么需要 RAG', sourceLabel: 'Overview（RAG 是什么？）', sourceHash: '#doxcnJF6FN008EDrEaiAvWdhbwd',
    problem: '模型能流畅回答，却不知道企业最新制度，也无法给出可核查出处', outcome: '能判断一个问题何时应使用 RAG 而不是微调或直接提示', insight: 'RAG 在回答时检索外部证据，把模型的生成能力与可更新知识源连接起来。', mechanism: '知识留在可维护的数据源中，查询时只注入相关片段，因此更新快且可引用。',
    steps: ['识别知识是否外部且会更新', '确认需要引用和权限控制', '用检索证据约束生成'], misconception: 'RAG 会把知识永久训练进模型参数', decision: '先判断知识更新频率、可引用性和访问边界', risk: '模型凭记忆编造过期资料', concepts: ['外部知识', '按需检索', '证据注入', '可更新回答'], practice: '为公司报销政策问答说明为什么选 RAG 而不是微调。', success: '理由覆盖更新成本、引用、权限和失败处理。',
  },
  {
    id: 'rag-pipeline', unitId: 'rag-foundations', title: '看懂 RAG 全链路', sourceLabel: '1、RAG 的整体架构设计', sourceHash: '#doxcnupYJQkKsahXRF7Cn1t3TSb',
    problem: '系统答错时团队只会换模型，无法定位索引、检索还是生成出了问题', outcome: '能画出 Indexing、Retrieval、Generation 三段数据流', insight: 'RAG 是三段系统：离线构建索引，在线检索证据，再基于证据生成。', mechanism: '每段都有独立输入输出和指标，必须分段诊断才能找到真实瓶颈。',
    steps: ['标出离线索引产物', '追踪查询到候选证据', '检查生成是否忠于证据'], misconception: '最终答案差一定是 LLM 不够强', decision: '先逐段保存中间结果并定位故障', risk: '检索为空却继续让模型自由回答', concepts: ['索引构建', '在线检索', '证据生成', '分段诊断'], practice: '为一次错误回答保存查询、候选块、排序结果、提示词和最终答案。', success: '能明确指出错误首次出现在哪一段。',
  },
  {
    id: 'rag-failure-taxonomy', unitId: 'rag-foundations', title: '建立 RAG 失败分类', sourceLabel: '一、概览', sourceHash: '#doxcn5wCIr3lm1ykg8oEvoTEbqc',
    problem: '检索不到、检索不准、答案不忠实和答案不完整混在同一个“效果差”标签里', outcome: '能把失败分为覆盖、召回、排序、上下文和生成忠实度问题', insight: '先定义失败类型，才能选择正确指标和修复杠杆。', mechanism: '不同失败层的优化手段可能相反，例如扩大召回会增加生成噪声。',
    steps: ['检查正确证据是否入库', '判断是否召回并排到前面', '检查生成是否使用证据'], misconception: '提高 Top-K 能同时解决所有 RAG 问题', decision: '先用失败样例贴层级标签再调参', risk: '一个指标提升却让另一层退化', concepts: ['覆盖率', '召回率', '排序质量', '答案忠实度'], practice: '把五个错误回答分别归因并写出对应修复动作。', success: '每个修复动作只针对首次失败的系统层。',
  },
  {
    id: 'data-ingestion', unitId: 'build-the-index', title: '可靠地接入数据', sourceLabel: '2.1 数据获取（Data Ingestion）', sourceHash: '#doxcnEXJDyr2Pez80zL9HoGNxZd',
    problem: '知识源格式各异且持续更新，索引中出现缺页、重复和过期版本', outcome: '能设计带来源、版本和权限元数据的数据接入流程', insight: '数据接入不仅是读文件，还要记录来源、版本、权限、解析状态和幂等标识。', mechanism: '稳定标识与校验值让重复导入、更新和回滚都可控。',
    steps: ['验证来源与文件类型', '提取正文和元数据', '用校验值幂等写入'], misconception: '只要文本能被读取，接入就算完成', decision: '先定义文档身份和更新策略再解析', risk: '同一文档多版本互相污染检索结果', concepts: ['数据来源', '版本元数据', '幂等导入', '权限继承'], practice: '为 PDF、网页和数据库记录设计统一接入字段。', success: '能区分同文档新版本、重复文件和无权限内容。',
  },
  {
    id: 'preprocessing', unitId: 'build-the-index', title: '清洗但不破坏语义', sourceLabel: '2.2 文档预处理（Preprocessing）', sourceHash: '#doxcn3HyJTAKzoZf3AtZoCF3CFd',
    problem: '页眉、导航、乱码和表格被直接索引，搜索结果充满噪声', outcome: '能制定保留结构与来源定位的预处理规则', insight: '预处理要移除无意义噪声，同时保留标题层级、列表、表格和页码等检索线索。', mechanism: '结构信息既帮助分块，也用于过滤、引用和阅读时回到原文。',
    steps: ['检测编码与解析质量', '去除重复模板噪声', '保留层级和定位元数据'], misconception: '预处理就是把所有标点和换行删除', decision: '先定义哪些结构会影响检索与引用', risk: '清洗后语义边界消失，引用无法定位', concepts: ['文本清洗', '结构保留', '解析质量', '来源定位'], practice: '对一页含页眉、标题、表格和脚注的文本标出保留与删除部分。', success: '结果可读、可分块且仍能回到原页或标题。',
  },
  {
    id: 'chunking', unitId: 'build-the-index', title: '用任务驱动分块', sourceLabel: '2.3 文档分块（Chunking）', sourceHash: '#doxcncVRU2GrLjYOEjozWDZx2Fd',
    problem: '分块太小丢上下文，太大又让检索命中后夹带大量无关内容', outcome: '能按标题、语义和查询粒度选择块大小与重叠', insight: '好分块让一个块能独立回答一种问题，同时保留必要上下文。', mechanism: '块边界影响嵌入表示、召回粒度、上下文成本和引用精度。',
    steps: ['分析典型问题粒度', '优先沿标题和语义边界切分', '用召回样例调整大小与重叠'], misconception: '固定 500 字适合所有文档和问题', decision: '先收集真实问题，再选择结构化分块策略', risk: '正确答案跨块被切断或被大块噪声淹没', concepts: ['语义边界', '块大小', '重叠', '查询粒度'], practice: '为制度条款、API 文档和聊天记录分别设计分块方案。', success: '每种方案都说明块边界、大小、重叠和失败样例。',
  },
  {
    id: 'embeddings', unitId: 'represent-and-store', title: '理解嵌入而非迷信向量', sourceLabel: '2.4 向量化（Embedding）', sourceHash: '#doxcnlTTHroMUADEU6SA3VD4vNf',
    problem: '把文本变成向量后就认为相似度一定等于业务相关性', outcome: '能解释嵌入、距离度量和领域适配的限制', insight: '嵌入把文本映射到语义空间，近邻代表模型学到的相似模式，不保证业务上可用。', mechanism: '模型、语言、长度和归一化方式都会改变向量分布和排序。',
    steps: ['选择适配语言与领域的模型', '统一归一化与距离度量', '用标注查询验证近邻'], misconception: '换成维度更高的嵌入就一定更准', decision: '先用真实查询集比较模型而不是只看维度', risk: '语义相近但答案无关的块占据前排', concepts: ['语义向量', '距离度量', '领域适配', '离线评估'], practice: '设计十条查询和相关文档标注，用于比较两种嵌入模型。', success: '评价基于同一标注集并报告召回而非主观样例。',
  },
  {
    id: 'vector-store', unitId: 'represent-and-store', title: '正确使用向量数据库', sourceLabel: '2.5 存储到向量数据库', sourceHash: '#doxcnYorMKkpJhUHhhRVp6Z9A9c',
    problem: '向量能检索，却无法按部门、时间和权限过滤，也无法安全更新', outcome: '能设计向量、正文、元数据和版本的存储模型', insight: '向量库负责近邻搜索，但可靠 RAG 还需要正文、元数据过滤、索引版本和删除传播。', mechanism: '结构化过滤先缩小合法候选集，再做向量检索，可同时提升安全性和相关性。',
    steps: ['定义文档与块主键', '保存向量和过滤元数据', '设计更新删除与索引版本'], misconception: '向量数据库可以替代所有结构化数据库', decision: '先明确检索与事务职责边界', risk: '删除原文后旧向量仍能被召回', concepts: ['向量索引', '元数据过滤', '版本控制', '删除传播'], practice: '为多部门制度库设计块表字段和访问过滤条件。', success: '无权限块在向量搜索前就被排除，更新可追踪到版本。',
  },
  {
    id: 'metadata-and-provenance', unitId: 'represent-and-store', title: '让每个块带着出处', sourceLabel: 'Indexing（索引构建）', sourceHash: '#doxcnARBg1Zko95b388nw2O1VTe',
    problem: '检索结果只有一段文字，不知道来自哪份文件、哪一页、哪个版本', outcome: '能设计可引用、可回源和可重定位的证据元数据', insight: '每个块必须携带文档身份、标题路径、页码或锚点、版本和权限。', mechanism: '出处元数据支持引用、去重、更新迁移和用户复核。',
    steps: ['生成稳定文档与块标识', '保存标题路径与页码', '保留版本和校验值'], misconception: '只保存文本和向量就足够生成引用', decision: '先定义回到原文的最小锚点', risk: '答案声称有依据却无法让用户核查', concepts: ['证据出处', '稳定锚点', '文档版本', '可追溯引用'], practice: '为 PDF 第 12 页一个段落设计完整块元数据。', success: '记录能唯一回到原文，并能判断文档更新后锚点是否仍有效。',
  },
  {
    id: 'query-processing', unitId: 'retrieve-evidence', title: '先处理查询再检索', sourceLabel: '3.1 查询处理', sourceHash: '#doxcn1GTIRalw74JXd81iSmfyLe',
    problem: '用户问题含代词、口语缩写和多重意图，直接嵌入后召回偏离', outcome: '能做上下文补全、意图拆分与检索查询构造', insight: '检索查询不一定等于用户原句，应在不改变意图的前提下补全实体和上下文。', mechanism: '消解指代与拆分多问题能让查询向量和关键词更接近目标证据。',
    steps: ['保留原始问题', '补全实体并拆分子问题', '分别检索后记录改写关系'], misconception: '让模型自由重写查询一定会提升召回', decision: '先判断是否存在指代、省略或多意图', risk: '查询改写改变原意，检索出错误证据', concepts: ['查询理解', '指代消解', '意图拆分', '可追踪改写'], practice: '把“它能报销吗？额度多少？”改写为可检索的两个子查询。', success: '改写补全实体但不增加原问题没有的事实。',
  },
  {
    id: 'dense-and-hybrid', unitId: 'retrieve-evidence', title: '组合向量与关键词检索', sourceLabel: '3.2 向量检索', sourceHash: '#doxcnco0PQvkd6j7uANIslSJpne',
    problem: '向量检索擅长语义，却漏掉精确编号、专有名词和错误码', outcome: '能判断何时使用稠密、稀疏或混合检索', insight: '向量检索覆盖语义相似，关键词检索捕捉精确词项；混合方案常比单一路线更稳。', mechanism: '两路召回后归一化或融合排序，可兼顾自然语言改写与精确匹配。',
    steps: ['分析查询的语义与精确词项', '并行执行稠密和稀疏召回', '统一融合并去重'], misconception: '现代嵌入已经让关键词检索完全过时', decision: '先用查询类型决定两路权重', risk: '错误码和产品型号被语义近邻替代', concepts: ['稠密检索', '稀疏检索', '混合召回', '结果融合'], practice: '为“ERR-1042 如何处理”和“怎么请育儿假”设计不同检索权重。', success: '精确编号与自然语言问题都能召回对应证据。',
  },
  {
    id: 'reranking', unitId: 'retrieve-evidence', title: '召回之后再精排', sourceLabel: '3.3 检索策略', sourceHash: '#doxcniW1uyTUJzVyixzgLa29DTh',
    problem: '正确块已在 Top-20 中，却因为初始相似度不够高没进入最终上下文', outcome: '能设计候选召回、重排和去重流程', insight: '第一阶段追求不漏，第二阶段用更强模型或规则判断查询与块的精确相关性。', mechanism: '两阶段检索把昂贵判断限制在小候选集，兼顾召回率和精度。',
    steps: ['宽召回候选集', '用交叉编码或规则重排', '去除相邻重复并选上下文'], misconception: 'Top-K 只要足够大就不需要重排', decision: '先测正确证据是否召回，再决定精排模型', risk: '大量近似块挤占上下文，正确证据排名过低', concepts: ['候选召回', '交叉编码重排', '去重', '上下文选择'], practice: '为 50 个候选块设计重排后选 6 段证据的规则。', success: '流程同时控制相关性、重复度和总 token 预算。',
  },
  {
    id: 'grounded-generation', unitId: 'answer-and-optimize', title: '用证据约束生成', sourceLabel: '4.1 提示词构建', sourceHash: '#doxcnjKPVYUzTtZLU6RnmT1ryoh',
    problem: '提示词提供了原文，但模型仍混入常识并把猜测说成确定答案', outcome: '能设计要求引用、区分证据不足并限制越界回答的生成提示', insight: 'Grounded Prompt 明确证据边界、回答格式、引用要求和无证据时的行为。', mechanism: '把“不要幻觉”改成可检查的输出契约，才能在后处理中验证。',
    steps: ['清晰分隔问题与证据', '要求逐项引用', '证据不足时固定拒答'], misconception: '只写“请根据上下文回答”就足以保证忠实', decision: '先定义证据不足和冲突证据的处理规则', risk: '答案引用了存在的片段，却做出片段不支持的推断', concepts: ['证据边界', '引用格式', '拒答策略', '忠实生成'], practice: '写一个只允许使用三段证据且必须标注出处的回答模板。', success: '模板能区分有证据、证据冲突和证据不足三种情况。',
  },
  {
    id: 'postprocess-citations', unitId: 'answer-and-optimize', title: '校验引用与答案后处理', sourceLabel: '4.3 答案后处理', sourceHash: '#doxcnF7pyjCezW8xRHJd91InImg',
    problem: '模型生成了看似规范的引用，但编号不存在或句子并不支持结论', outcome: '能在返回用户前校验结构、引用和敏感内容', insight: '引用必须绑定实际检索块，并检查每个关键结论是否有对应证据。', mechanism: '结构化输出和程序化校验能拦截伪造引用、格式错误与越权内容。',
    steps: ['解析结构化答案', '验证引用 ID 与证据关系', '应用权限和敏感信息过滤'], misconception: '模型生成了引用标记就说明引用真实可靠', decision: '先程序校验引用再显示答案', risk: '用户点击引用后发现内容与结论无关', concepts: ['结构化输出', '引用校验', '证据蕴含', '安全过滤'], practice: '为包含 answer、citations、confidence 的响应写校验清单。', success: '不存在的引用、无支撑结论和越权片段都会被拒绝。',
  },
  {
    id: 'rag-evaluation', unitId: 'answer-and-optimize', title: '分开评估检索与生成', sourceLabel: '3.4 检索效果评估指标', sourceHash: '#doxcnlg29nEOLoa9ufIPBfv6O0g',
    problem: '只看用户点赞率，无法知道 RAG 的召回和忠实度到底哪里在变化', outcome: '能建立包含 Recall@K、MRR、Faithfulness 和 Answer Relevance 的评估集', insight: '检索指标回答证据是否找到和排得多高，生成指标回答答案是否忠实、相关和完整。', mechanism: '分层指标让优化有归因，端到端任务成功率则验证整体价值。',
    steps: ['构建查询、证据、答案标注集', '分别测检索和生成', '结合失败类型做回归'], misconception: '一个综合分数就足以指导所有优化', decision: '先定义每层最少一个可解释指标', risk: '总分变化却不知道是召回还是生成导致', concepts: ['Recall@K', 'MRR', 'Faithfulness', '分层评估'], practice: '为 20 条问答建立检索证据和答案要点标注。', success: '同一失败能同时看到检索与生成层指标，并可复现。',
  },
  {
    id: 'multi-query', unitId: 'answer-and-optimize', title: '用 Multi Query 扩大召回', sourceLabel: 'Multi Query－多查询策略', sourceHash: '#doxcnMGq5Cc2NYgGljKSTgE6Tye',
    problem: '用户表达方式与文档措辞不同，单一查询向量漏掉正确证据', outcome: '能生成保持原意的多视角查询并合并结果', insight: 'Multi Query 用不同措辞和角度覆盖同一信息需求，提升对表达差异的鲁棒性。', mechanism: '多路查询扩大候选集合，但必须控制语义漂移、成本和重复。',
    steps: ['定义原始意图与不可变实体', '生成少量互补查询', '合并去重并追踪来源'], misconception: '生成的查询越多召回一定越好', decision: '先限制查询数量并检查是否保持原意', risk: '查询扩展引入新意图，召回大量无关内容', concepts: ['查询扩展', '表达多样性', '语义漂移', '结果去重'], practice: '为“远程办公设备如何报销”生成三个互补但不改变意图的查询。', success: '三个查询覆盖同义表达、规则对象和流程角度，且不添加新条件。',
  },
  {
    id: 'rag-fusion', unitId: 'answer-and-optimize', title: '用 RAG-Fusion 合并多路结果', sourceLabel: 'RAG-Fusion－多查询结果融合策略', sourceHash: '#doxcn1YP0Z6aPKiMvGcGkwl9ahh',
    problem: '多查询各自返回不同排名，直接拼接会让重复块和某一路结果主导上下文', outcome: '能用排名融合把多路候选合并成稳定列表', insight: 'RAG-Fusion 先多查询召回，再用排名信息融合，降低单一路径偶然性。', mechanism: '融合关注文档在多路列表中的相对位置，而不是直接比较不同检索器的原始分数。',
    steps: ['执行多路查询', '为每路记录排名', '融合分数后去重重排'], misconception: '不同查询的相似度分数可以直接相加且天然可比', decision: '先统一使用排名融合再设阈值', risk: '原始分数量纲不同导致结果偏向某一路', concepts: ['多路召回', '排名融合', '分数不可比', '稳定排序'], practice: '把三路各五个结果合并，说明重复文档如何计分。', success: '融合不依赖原始分数量纲，重复文档只保留一次。',
  },
  {
    id: 'rrf-and-production', unitId: 'answer-and-optimize', title: '用 RRF 完成生产级闭环', sourceLabel: '什么是 RRF？', sourceHash: '#doxcnqIG44WbILPrWEwjR98U5df',
    problem: '优化策略在样例中有效，却没有成本、延迟、回归和降级设计', outcome: '能实现 RRF 并把效果、成本与故障降级纳入上线验收', insight: 'RRF 用 1/(k+rank) 聚合排名，简单稳健；生产系统还必须有缓存、超时和无证据降级。', mechanism: '固定公式避免跨检索器分数标定，运行边界保证优化不会拖垮在线体验。',
    steps: ['实现 RRF 与去重', '测量质量、延迟和 token 成本', '设置超时、缓存与拒答降级'], misconception: '离线 Recall 提升就可以直接上线', decision: '先在固定评估集与延迟预算内验收', risk: '多查询提高质量却让成本和响应时间失控', concepts: ['RRF', '质量延迟权衡', '缓存超时', '生产降级'], practice: '为多查询 RAG 写一份包含质量、P95 延迟、成本和降级的发布检查表。', success: '任一外部依赖失败时仍能给出明确、无编造的用户反馈。',
    codeTitle: 'RRF 核心', code: `score = 0\nfor ranking in rankings:\n    for rank, doc in enumerate(ranking, 1):\n        fused[doc.id] += 1 / (60 + rank)`,
  },
]

export default defineCourseChapter({
  id: 'rag', title: 'RAG 技术深入理解', shortTitle: 'RAG', order: 4, prerequisites: ['agent', 'transformer'],
  sourceId: 'rag-manual', sourceTitle: 'AI 应用开发：RAG 技术从小白到深入理解', sourceUrl,
  units: [
    { id: 'rag-foundations', title: '建立 RAG 系统观', stageIds: ['rag-why', 'rag-pipeline', 'rag-failure-taxonomy'] },
    { id: 'build-the-index', title: '构建可靠索引', stageIds: ['data-ingestion', 'preprocessing', 'chunking'] },
    { id: 'represent-and-store', title: '表示、存储与出处', stageIds: ['embeddings', 'vector-store', 'metadata-and-provenance'] },
    { id: 'retrieve-evidence', title: '找准证据', stageIds: ['query-processing', 'dense-and-hybrid', 'reranking'] },
    { id: 'answer-and-optimize', title: '生成、评估与优化', stageIds: ['grounded-generation', 'postprocess-citations', 'rag-evaluation', 'multi-query', 'rag-fusion', 'rrf-and-production'] },
  ],
  stages,
  activities: ragActivities,
})
