import { defineCourseChapter, type CourseStageSeed } from '../factory'
import { transformerActivities } from './activities'

const sourceUrl = 'https://gcnum0i2ctpz.feishu.cn/docx/YdS7doO4joXk0wxVbAzc4T1LnNd'

const stages: CourseStageSeed[] = [
  {
    id: 'why-transformer', unitId: 'foundations', title: 'Transformer 解决了什么', sourceLabel: '1.1 Transformer 解决了什么问题？', sourceHash: '#doxcnh0hu2SK2r2MeKMReFDlFLg',
    problem: '长文本中的远距离关系难以被顺序模型稳定捕捉，训练也难以并行', outcome: '能解释 Transformer 相比 RNN 的核心改进和适用边界', insight: 'Transformer 用注意力直接连接任意位置，并让序列位置可以并行计算。', mechanism: '更短的信息路径缓解长距离依赖，并行矩阵运算更适合大规模硬件。',
    steps: ['找出序列中的依赖关系', '比较信息路径与并行性', '根据任务长度选择架构'], misconception: 'Transformer 只是更大的循环神经网络', decision: '先判断任务是否需要长距离依赖与并行训练', risk: '把架构优势误解成模型天然理解一切', concepts: ['长距离依赖', '并行计算', '注意力连接', '架构选择'], practice: '比较一句 1000 字文档在 RNN 与自注意力中的信息传播路径。', success: '能用路径长度和并行性两项指标解释差异。',
  },
  {
    id: 'transformer-and-llm', unitId: 'foundations', title: 'Transformer 与大模型的关系', sourceLabel: '二、Transformer 和大模型是什么关系？', sourceHash: '#doxcnoU2tdo72sCXGpInW9PUtLh',
    problem: '把 Transformer、GPT 和大语言模型当作三个同义词，导致技术判断混乱', outcome: '能区分架构、训练后模型与具体产品', insight: 'Transformer 是计算架构，大模型是大规模参数与数据训练出的系统，GPT 是其中一类 Decoder-Only 实现。', mechanism: '同一架构可按数据、目标和规模训练出不同能力，产品还会叠加检索、工具和安全层。',
    steps: ['识别讨论的是架构还是模型', '说明训练目标与规模', '补上产品系统层'], misconception: '用了 Transformer 就自动成为通用大模型', decision: '先把架构、模型、应用三层分开描述', risk: '在选型时用产品名称替代技术约束', concepts: ['计算架构', '预训练模型', '训练目标', '产品系统'], practice: '用三层图解释 Transformer、GPT 模型和聊天产品的关系。', success: '每层都有独立输入、输出与职责，不再互相混用。',
  },
  {
    id: 'artificial-neuron', unitId: 'foundations', title: '从人工神经元理解网络', sourceLabel: '3.2 人工神经元', sourceHash: '#doxcnIEJPqkCFP4MP5tcyxKFPXc',
    problem: '会调用模型却无法理解权重、偏置和非线性如何共同形成表示', outcome: '能手算一个神经元并解释参数学习的对象', insight: '人工神经元先做加权求和，再经激活函数产生可组合的非线性输出。', mechanism: '权重选择信号，偏置移动阈值，激活函数让多层网络不退化为线性变换。',
    steps: ['计算加权和', '加入偏置', '通过激活函数并解释输出'], misconception: '神经元直接存储完整知识句子', decision: '先追踪数值变换而不是赋予单个参数人类语义', risk: '无法解释梯度到底更新了什么', concepts: ['权重', '偏置', '激活函数', '表示学习'], practice: '给定两个输入、权重和偏置，手算 ReLU 神经元输出。', success: '计算正确，并能说明改变任一参数会怎样影响输出。',
  },
  {
    id: 'activation-functions', unitId: 'representations', title: '激活函数为何不可少', sourceLabel: '4.1 为什么需要激活函数？', sourceHash: '#doxcnURmvypheoot5bDsuw6D1le',
    problem: '堆叠很多线性层却发现表达能力没有实质提升', outcome: '能解释非线性作用，并比较 ReLU、Sigmoid 与 GELU 的常见用途', insight: '没有激活函数，多层线性变换仍等价于一层线性变换。', mechanism: '非线性允许网络形成分段和弯曲决策边界，梯度特性又影响训练稳定性。',
    steps: ['识别输出范围需求', '比较梯度与计算成本', '用训练曲线验证选择'], misconception: '激活函数只是让数值落在固定范围', decision: '按网络位置和优化特性选择激活函数', risk: '梯度消失、死亡神经元或输出语义错误', concepts: ['非线性', '梯度传播', '输出范围', '函数选择'], practice: '为隐藏层与二分类输出层分别选择激活函数并说明理由。', success: '选择同时满足表示能力、梯度和输出语义。',
  },
  {
    id: 'tokens-and-embeddings', unitId: 'representations', title: '把词元变成向量', sourceLabel: 'AI 建模的核心：特征抽取器', sourceHash: '#doxcnTcLFGoiE59XIzFpre1NW0f',
    problem: '模型只能处理数字，但自然语言由离散符号组成', outcome: '能解释词元、嵌入矩阵与上下文表示的区别', insight: '词元 ID 通过嵌入矩阵查表变成连续向量，后续层再把静态向量变成上下文相关表示。', mechanism: '连续空间让相似模式可以共享统计结构，也让梯度能更新表示。',
    steps: ['完成分词并得到 ID', '查表获得初始嵌入', '经多层注意力更新上下文表示'], misconception: '一个词元永远对应同一个最终含义向量', decision: '先区分输入嵌入与层内上下文表示', risk: '把分词错误误判为模型推理错误', concepts: ['词元', '嵌入矩阵', '连续表示', '上下文表示'], practice: '画出一句话从字符到 token ID、embedding 再到隐藏状态的流程。', success: '能指出静态查表发生在哪一步、语境变化发生在哪一步。',
  },
  {
    id: 'positional-information', unitId: 'representations', title: '让模型知道顺序', sourceLabel: 'Transformer 整体架构详解', sourceHash: '#doxcnInx9ynhuZtsJphLJwmwnOe',
    problem: '自注意力只看集合关系，若没有额外信号就分不清词序', outcome: '能解释位置编码为何必要以及绝对、相对位置的差异', insight: '位置表示把顺序注入 token 表示，使注意力能区分“谁在谁之前”。', mechanism: '绝对位置标记坐标，相对位置直接影响 token 间距离关系，各有长度外推差异。',
    steps: ['确认任务依赖哪种顺序', '选择位置表示', '测试超出训练长度的行为'], misconception: '注意力权重本身天然包含词序', decision: '先定义位置需求，再选择绝对或相对方案', risk: '模型在顺序敏感任务中产生相反含义', concepts: ['位置编码', '顺序信息', '相对距离', '长度外推'], practice: '用“狗咬人”和“人咬狗”说明无位置表示会丢失什么。', success: '能明确指出内容相同而顺序不同为何需要额外位置特征。',
  },
  {
    id: 'encoder-decoder', unitId: 'architecture', title: '拆开编码器与解码器', sourceLabel: '3.2 编码器－解码器结构', sourceHash: '#doxcn6mfEMXqKN5PyQyK1TvUQAb',
    problem: '面对翻译、分类和生成任务，不知道该用 Encoder、Decoder 还是两者', outcome: '能根据输入输出关系选择架构', insight: 'Encoder 聚合输入表示，Decoder 自回归地产生输出；两者结合适合条件生成。', mechanism: '不同注意力可见范围对应理解、生成和输入到输出对齐三种需求。',
    steps: ['判断是否需要生成序列', '确定输入是否独立编码', '选择可见性与交叉注意力'], misconception: '所有 Transformer 都必须有编码器和解码器', decision: '先按任务输出形式选择架构族', risk: '用错误可见性造成信息泄露或能力浪费', concepts: ['编码器', '解码器', '交叉注意力', '任务适配'], practice: '为情感分类、文本续写和翻译分别选择架构。', success: '三类任务的选择与信息流一致，并能解释原因。',
  },
  {
    id: 'encoder-block', unitId: 'architecture', title: '理解编码器内部数据流', sourceLabel: '3.4 编码器内部结构', sourceHash: '#doxcnOgWHpbLjLbLUHzbtmjB0Qc',
    problem: '知道编码器包含注意力和前馈网络，却说不清残差与归一化的位置', outcome: '能按顺序追踪一个编码器块的输入输出', insight: '编码器块由多头自注意力、残差与归一化、逐位置前馈网络构成。', mechanism: '注意力混合 token 信息，前馈层变换每个位置，残差和归一化稳定深层训练。',
    steps: ['计算自注意力', '加入残差并归一化', '经过前馈层再次残差归一化'], misconception: '前馈网络负责 token 之间的信息交换', decision: '沿张量形状逐步追踪编码器块', risk: '实现时残差维度或归一化位置错误', concepts: ['自注意力', '前馈网络', '残差连接', '归一化'], practice: '为形状 [batch, seq, hidden] 标注每个子层前后的形状。', success: '所有残差相加维度一致，并说明哪个子层负责跨 token 交互。',
  },
  {
    id: 'decoder-block', unitId: 'architecture', title: '理解解码器与因果遮罩', sourceLabel: '3.5 解码器内部结构', sourceHash: '#doxcnKn9NhNqdwkB3zuiKi7aKYg',
    problem: '训练生成模型时不小心让当前位置看到未来答案，离线指标虚高', outcome: '能解释 Masked Self-Attention 如何保证自回归', insight: '因果遮罩禁止位置关注未来 token，使训练时的可见信息与生成时一致。', mechanism: '并行训练仍可一次计算所有位置，但遮罩把未来注意力分数设为不可选。',
    steps: ['构造下三角可见性', '应用遮罩后归一化', '逐位置预测下一个 token'], misconception: '训练阶段可以看未来，因为推理时会自动纠正', decision: '先校验注意力掩码再相信损失值', risk: '标签泄露导致训练指标好、实际生成差', concepts: ['因果遮罩', '自回归', '标签泄露', '可见性边界'], practice: '画出长度 4 序列的因果注意力矩阵。', success: '第 i 个位置只允许关注不晚于 i 的位置。',
  },
  {
    id: 'attention-intuition', unitId: 'attention', title: '用信息路由理解注意力', sourceLabel: '5.1 直观理解注意力', sourceHash: '#doxcn5sjDpDHE9c9uRL678YWluh',
    problem: '把注意力当作神秘的“模型在思考”，无法判断它实际计算了什么', outcome: '能把注意力解释为基于相关性的加权信息汇总', insight: '每个位置提出查询，与其他位置的键比较，再按权重汇总对应的值。', mechanism: '相似度决定从哪些位置取多少信息，输出是值向量的加权和。',
    steps: ['用 Query 表达当前需求', '和 Keys 计算相关性', '按权重汇总 Values'], misconception: '注意力权重就是严格的人类解释或因果关系', decision: '先把 Q、K、V 映射到信息检索问题', risk: '把高权重直接当作模型决策原因', concepts: ['查询', '键', '值', '加权汇总'], practice: '用“代词指代”例子说明一个 token 如何从其他位置取信息。', success: '能分别说明 Query、Key、Value 在例子中的角色。',
  },
  {
    id: 'qkv-matrices', unitId: 'attention', title: '算清 Q、K、V', sourceLabel: '5.2 注意力计算的直观过程', sourceHash: '#doxcnYW4nfz3KCgp7q6V5cga7jd',
    problem: '会背公式，却不知道 Q、K、V 为什么来自同一输入的不同投影', outcome: '能用矩阵形状完成一轮自注意力计算', insight: '同一隐藏状态通过三组可学习矩阵投影成查询、键和值，以分离匹配与承载内容的角色。', mechanism: 'QKᵀ 产生两两相关性，Softmax 后与 V 相乘得到上下文表示。',
    steps: ['线性投影得到 QKV', '计算缩放点积与 Softmax', '权重乘 V 得到输出'], misconception: 'Q、K、V 是三份独立输入数据', decision: '先写清每个矩阵形状再计算', risk: '维度转置错误导致注意力沿错误轴计算', concepts: ['线性投影', '点积相似度', 'Softmax', '矩阵形状'], practice: '对 2 个 token、2 维向量手算一个简化注意力输出。', success: '形状、归一化方向和加权和均正确。',
    codeTitle: '缩放点积注意力', code: `scores = (Q @ K.transpose(-2, -1)) / sqrt(d_k)\nweights = softmax(scores, dim=-1)\noutput = weights @ V`,
  },
  {
    id: 'scaled-dot-product', unitId: 'attention', title: '为什么点积需要缩放', sourceLabel: '注意力计算过程', sourceHash: '#doxcnYW4nfz3KCgp7q6V5cga7jd',
    problem: '隐藏维度增大后注意力分数过大，Softmax 变得极端且梯度很小', outcome: '能解释除以 √dₖ 对数值稳定性的作用', insight: '维度越大，随机点积方差越大；缩放把分数拉回 Softmax 的有效梯度区间。', mechanism: '除以 √dₖ 近似抵消方差随维度增长，避免概率过早饱和。',
    steps: ['估计点积分布', '按键维度缩放', '观察权重熵与梯度'], misconception: '缩放只是为了让最终概率加起来等于一', decision: '先按 dₖ 缩放再进入 Softmax', risk: '高维时注意力几乎变成硬选择，训练不稳定', concepts: ['点积方差', '维度缩放', 'Softmax 饱和', '数值稳定'], practice: '比较 dₖ=4 与 dₖ=256 时未缩放点积对 Softmax 的影响。', success: '能用方差和梯度解释 √dₖ，而不是只背公式。',
  },
  {
    id: 'multi-head-attention', unitId: 'attention', title: '多头注意力为何有用', sourceLabel: '注意力机制图解', sourceHash: '#doxcnnV5efAcHnO4QB774D3ORph',
    problem: '单个注意力分布需要同时表达语法、指代、位置等多种关系', outcome: '能解释多头并行子空间及合并过程', insight: '多个头在不同投影子空间学习不同关系，再拼接并投影回隐藏维度。', mechanism: '每个头维度更小但关注模式独立，组合后提升表示多样性。',
    steps: ['按头拆分投影维度', '各头独立计算注意力', '拼接并线性映射'], misconception: '头数越多效果一定越好且没有成本', decision: '按隐藏维度、任务和算力选择头数', risk: '每头维度过小或多个头学习重复模式', concepts: ['投影子空间', '并行注意力头', '拼接', '容量权衡'], practice: '给 hidden=768、12 个头计算每头维度并画出合并流程。', success: '每头维度和最终输出维度正确，能说出头数的成本。',
  },
  {
    id: 'decoder-only', unitId: 'language-models', title: 'Decoder-Only 如何生成文本', sourceLabel: '四、Decoder-Only 架构', sourceHash: '#doxcnQ3mluD5GFf8soR0dBmvIve',
    problem: '不理解 GPT 为什么只用 Decoder 仍能完成理解与生成任务', outcome: '能说明 Decoder-Only 的训练目标、上下文建模与生成循环', insight: 'Decoder-Only 通过因果自注意力学习“给定前文预测下一个 token”，规模化后形成通用序列建模能力。', mechanism: '同一目标覆盖大量语言模式，推理时把新 token 追加到上下文并重复预测。',
    steps: ['输入前缀并使用因果遮罩', '预测下一个 token 分布', '采样后追加并继续'], misconception: 'Decoder-Only 没有编码输入，因此看不懂上下文', decision: '先用自回归目标解释能力，再讨论产品层增强', risk: '忽略上下文窗口、采样和累积误差', concepts: ['因果语言模型', '下一个词预测', '上下文前缀', '生成循环'], practice: '用三步例子演示模型如何从“今天天气”连续生成两个 token。', success: '每一步只使用已出现 token，且明确概率分布与采样的区别。',
  },
  {
    id: 'training-and-inference', unitId: 'language-models', title: '区分训练、预填充与解码', sourceLabel: '2.3 训练大模型的过程', sourceHash: '#doxcnB05U2bBTUTfMJL0F6JBIvg',
    problem: '把训练和在线生成当作同一种计算，无法理解延迟与显存瓶颈', outcome: '能区分并行训练、Prompt Prefill 和逐 token Decode', insight: '训练并行计算全部位置并反向传播；推理预填充处理输入，解码借助 KV Cache 逐 token 生成。', mechanism: '三个阶段的计算密度、内存访问和优化目标不同。',
    steps: ['识别当前阶段', '分析计算与内存瓶颈', '选择批处理或缓存优化'], misconception: '推理就是没有梯度的训练，性能特征完全相同', decision: '先分阶段测量首 token 与后续 token 延迟', risk: '只优化吞吐却恶化交互延迟', concepts: ['并行训练', '预填充', '自回归解码', 'KV Cache'], practice: '为聊天请求画出 prefill 与连续三次 decode 的时间线。', success: '能标出哪些计算可复用以及首 token 延迟来自哪里。',
  },
  {
    id: 'architecture-tradeoffs', unitId: 'language-models', title: '用边界条件评估 Transformer', sourceLabel: '五、总结：把所有知识串起来', sourceHash: '#doxcnqH16ASWD8u4uuspEo0nlOg',
    problem: '看到 Transformer 成功就默认它在任何长度、成本和数据条件下都是最佳方案', outcome: '能从复杂度、上下文、数据与任务目标评估架构权衡', insight: '标准注意力的时间和内存随序列长度近似平方增长，能力还受训练数据与目标限制。', mechanism: '架构提供归纳偏置，不会消除有限上下文、幻觉、成本和分布外问题。',
    steps: ['量化序列长度与成本', '检查任务和数据分布', '用基准与失败样例验证'], misconception: '参数越多就能自动解决长上下文与事实可靠性', decision: '先写出性能与质量边界再做选型', risk: '方案在样例上惊艳，却在真实长度和成本下不可用', concepts: ['二次复杂度', '上下文限制', '数据依赖', '选型边界'], practice: '为 100 字分类与 100 万字检索任务分别评估是否直接使用标准注意力。', success: '两项选择都包含复杂度、数据和替代方案证据。',
  },
]

export default defineCourseChapter({
  id: 'transformer', title: 'Transformer 架构深度解析', shortTitle: 'Transformer', order: 3, prerequisites: ['agent'],
  sourceId: 'transformer-manual', sourceTitle: '大模型 Transformer 架构从 0–1 深度解析', sourceUrl,
  units: [
    { id: 'foundations', title: '先建立底层直觉', stageIds: ['why-transformer', 'transformer-and-llm', 'artificial-neuron'] },
    { id: 'representations', title: '表示与非线性', stageIds: ['activation-functions', 'tokens-and-embeddings', 'positional-information'] },
    { id: 'architecture', title: '打开架构黑盒', stageIds: ['encoder-decoder', 'encoder-block', 'decoder-block'] },
    { id: 'attention', title: '算清注意力', stageIds: ['attention-intuition', 'qkv-matrices', 'scaled-dot-product', 'multi-head-attention'] },
    { id: 'language-models', title: '走向大语言模型', stageIds: ['decoder-only', 'training-and-inference', 'architecture-tradeoffs'] },
  ],
  stages,
  activities: transformerActivities,
})
