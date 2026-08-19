import { createChapterActivities, field, jsonObjectCheck, testOutputCheck } from '../activityBuilders'

const stages = [
  ['why-transformer', 'foundations'], ['transformer-and-llm', 'foundations'], ['artificial-neuron', 'foundations'],
  ['activation-functions', 'representations'], ['tokens-and-embeddings', 'representations'], ['positional-information', 'representations'],
  ['encoder-decoder', 'architecture'], ['encoder-block', 'architecture'], ['decoder-block', 'architecture'],
  ['attention-intuition', 'attention'], ['qkv-matrices', 'attention'], ['scaled-dot-product', 'attention'], ['multi-head-attention', 'attention'],
  ['decoder-only', 'language-models'], ['training-and-inference', 'language-models'], ['architecture-tradeoffs', 'language-models'],
].map(([id, unitId]) => ({ id, unitId, title: id.replaceAll('-', ' ') }))

const foundations = field('foundations', '神经元实验与基础说明', '01-neuron-lab.mjs + foundations.md', 'json', '填写 inputs、weights、bias、activation、expectedOutput。', '{"inputs":[1,2],"weights":[0.5,-0.25],"bias":0.5,"activation":"relu","expectedOutput":0.5}')
const representations = field('representations', 'Token、向量与位置', '02-representations.mjs + tokens-and-positions.json', 'json', '填写 tokens、embeddingDimension、embeddings、positions 和 combined。', '{"tokens":["我","学","AI"],"embeddingDimension":2,"embeddings":[[1,0],[0,1],[1,1]],"positions":[[0,1],[1,0],[0.5,0.5]],"combined":[[1,1],[1,1],[1.5,1.5]]}')
const architecture = field('architecture', '架构追踪与因果遮罩', '03-architecture-trace.md + mask-matrix.json', 'json', '填写 tokens、mask 和 rule，未来位置必须不可见。', '{"tokens":["A","B","C"],"mask":[[1,0,0],[1,1,0],[1,1,1]],"rule":"position i can attend only to j <= i"}')
const attention = field('attention', '注意力数值夹具', '04-attention.mjs + attention-fixtures.json', 'json', '填写 q、k、v、scale、mask、weights、heads 和 output。', '{"q":[[1,0]],"k":[[1,0],[0,1]],"v":[[2,0],[0,2]],"scale":1.414,"mask":[1,0],"weights":[1,0],"heads":2,"output":[2,0]}')
const decoder = field('decoder', 'Decoder-Only 模拟与权衡', '05-decoder-simulation.mjs + architecture-tradeoff.md', 'json', '填写 prompt、generatedTokens、stopToken、prefillSteps、decodeSteps 和 boundaryCases。', '{"prompt":["学习"],"generatedTokens":["使","人","进步","<eos>"],"stopToken":"<eos>","prefillSteps":1,"decodeSteps":4,"boundaryCases":["maxTokens","unknownToken"]}')
const tests = field('test-output', '本机测试输出', '终端输出', 'test-output', '运行 npm test，粘贴零失败摘要。', '# pass 10\n# fail 0')

export const transformerActivities = createChapterActivities({
  projectName: '迷你注意力实验室', starterPackUrl: '/practice/transformer-attention-lab-starter.zip',
  context: '你用极小的固定数字样本手算并编码 Transformer 核心过程，不训练模型、不下载数据。',
  fixtures: ['固定 token：A、B、C', '向量维度不超过 4，矩阵可人工复核', 'Node.js 20+ 与 node --test'],
  conceptStageIds: ['why-transformer', 'transformer-and-llm'], stages,
  milestones: [
    { stageId: 'artificial-neuron', title: '里程碑 1：算清人工神经元', fields: [foundations], artifactFiles: ['01-neuron-lab.mjs', 'foundations.md'], autoChecks: [jsonObjectCheck('neuron-json', '神经元夹具', 'foundations', ['inputs', 'weights', 'bias', 'activation', 'expectedOutput'])], rubricFocus: ['计算可复核', '激活边界明确', '架构与模型区分'] },
    { stageId: 'positional-information', title: '里程碑 2：构造输入表示', fields: [representations], artifactFiles: ['02-representations.mjs', 'tokens-and-positions.json'], autoChecks: [jsonObjectCheck('repr-json', '表示结构', 'representations', ['tokens', 'embeddingDimension', 'embeddings', 'positions', 'combined'])], rubricFocus: ['维度一致', '位置信息可见', '边界样本覆盖'] },
    { stageId: 'decoder-block', title: '里程碑 3：追踪 Encoder/Decoder', fields: [architecture], artifactFiles: ['03-architecture-trace.md', 'mask-matrix.json'], autoChecks: [jsonObjectCheck('mask-json', '遮罩结构', 'architecture', ['tokens', 'mask', 'rule'])], rubricFocus: ['数据流完整', '未来 token 不可见', '模块职责清楚'] },
    { stageId: 'multi-head-attention', title: '里程碑 4：实现缩放点积注意力', fields: [attention, tests], artifactFiles: ['04-attention.mjs', 'attention-fixtures.json'], autoChecks: [jsonObjectCheck('attention-json', '注意力夹具', 'attention', ['q', 'k', 'v', 'scale', 'mask', 'weights', 'heads', 'output']), testOutputCheck('attention-tests', '注意力测试')], rubricFocus: ['QKV 维度正确', '权重和可验证', '遮罩与多头有效'] },
    { stageId: 'architecture-tradeoffs', title: '里程碑 5：完成 Decoder 模拟', fields: [decoder, tests], artifactFiles: ['05-decoder-simulation.mjs', 'architecture-tradeoff.md'], autoChecks: [jsonObjectCheck('decoder-json', '生成轨迹', 'decoder', ['prompt', 'generatedTokens', 'stopToken', 'prefillSteps', 'decodeSteps', 'boundaryCases']), testOutputCheck('decoder-tests', '完整实验测试')], rubricFocus: ['生成只看前文', '终止条件明确', '长短任务权衡有证据'] },
  ],
})
