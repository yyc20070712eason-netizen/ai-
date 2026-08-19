import { createChapterActivities, field, jsonArrayCheck, jsonObjectCheck, testOutputCheck } from '../activityBuilders'

const stages = [
  ['rag-why', 'rag-foundations'], ['rag-pipeline', 'rag-foundations'], ['rag-failure-taxonomy', 'rag-foundations'],
  ['data-ingestion', 'build-the-index'], ['preprocessing', 'build-the-index'], ['chunking', 'build-the-index'],
  ['embeddings', 'represent-and-store'], ['vector-store', 'represent-and-store'], ['metadata-and-provenance', 'represent-and-store'],
  ['query-processing', 'retrieve-evidence'], ['dense-and-hybrid', 'retrieve-evidence'], ['reranking', 'retrieve-evidence'],
  ['grounded-generation', 'answer-and-optimize'], ['postprocess-citations', 'answer-and-optimize'], ['rag-evaluation', 'answer-and-optimize'], ['multi-query', 'answer-and-optimize'], ['rag-fusion', 'answer-and-optimize'], ['rrf-and-production', 'answer-and-optimize'],
].map(([id, unitId]) => ({ id, unitId, title: id.replaceAll('-', ' ') }))

const systemMap = field('system-map', 'RAG 系统图与失败分类', '01-rag-system-map.md + failure-taxonomy.json', 'json', '填写 stages、failureTypes 和 refusalRules。', '{"stages":["ingest","chunk","retrieve","rerank","answer"],"failureTypes":["retrieval","generation","citation"],"refusalRules":["no-evidence"]}')
const chunks = field('chunks', '清洗与分块结果', '02-chunks.json + ingestion-report.md', 'json', '提交 chunk 数组，每项含 id、source、title、start、end、text。', '[{"id":"c1","source":"course-a","title":"注意力","start":0,"end":20,"text":"注意力根据相关性分配权重。"}]')
const index = field('index', '索引与出处', '03-index.json + provenance-rules.md', 'json', '填写 documents，每项含 chunkId、keywords、embedding、metadata.source、metadata.version。', '{"documents":[{"chunkId":"c1","keywords":["注意力"],"embedding":[1,0,0],"metadata":{"source":"course-a","version":"v1"}}]}')
const retrieval = field('retrieval', '混合检索与精排样本', '04-retrieval.mjs + retrieval-cases.json', 'json', '至少 6 条案例，覆盖 keyword、vector、hybrid、no-result。', '[{"id":"r1","category":"hybrid","query":"注意力权重","expectedTopIds":["c1"],"fallback":"none"}]')
const release = field('release', '端到端答案与发布清单', 'evaluation-report.md + release-checklist.json', 'json', '填写 metrics、citationPolicy、budgets、degradation、rrf。', '{"metrics":{"recallAtK":0.8,"mrr":0.75,"citationCoverage":1},"citationPolicy":{"existingChunkOnly":true},"budgets":{"p95Ms":500},"degradation":["refuse-without-evidence"],"rrf":{"k":60,"deduplicate":true}}')
const tests = field('test-output', '本机测试输出', '终端输出', 'test-output', '运行 npm test 并粘贴零失败摘要。', '# pass 12\n# fail 0')

export const ragActivities = createChapterActivities({
  projectName: '本地课程资料检索器', starterPackUrl: '/practice/rag-course-retriever-starter.zip',
  context: '你只使用起始包中的三份虚构课程资料，构建不联网的分块、检索、引用和拒答闭环。',
  fixtures: ['三份虚构课程文档与固定问题集', '向量使用手写三维 fixture，不调用 embedding API', '答案只能引用已检索 chunk ID'],
  conceptStageIds: ['rag-why', 'rag-pipeline'], stages,
  milestones: [
    { stageId: 'rag-failure-taxonomy', title: '里程碑 1：画清 RAG 与失败边界', fields: [systemMap], artifactFiles: ['01-rag-system-map.md', 'failure-taxonomy.json'], autoChecks: [jsonObjectCheck('system-json', '系统与失败结构', 'system-map', ['stages', 'failureTypes', 'refusalRules'])], rubricFocus: ['检索与生成分层', '拒答边界明确', '失败可归因'] },
    { stageId: 'chunking', title: '里程碑 2：生成可追溯分块', fields: [chunks], artifactFiles: ['02-chunks.json', 'ingestion-report.md'], autoChecks: [jsonArrayCheck('chunks-json', '分块结构', 'chunks', 4, ['id', 'source', 'title', 'start', 'end', 'text'])], rubricFocus: ['分块 ID 唯一', '边界与重叠有理由', '来源完整'] },
    { stageId: 'metadata-and-provenance', title: '里程碑 3：建立索引与出处', fields: [index], artifactFiles: ['03-index.json', 'provenance-rules.md'], autoChecks: [jsonObjectCheck('index-json', '索引结构', 'index', ['documents'])], rubricFocus: ['关键词与向量并存', '版本可追溯', '出处不可丢失'] },
    { stageId: 'reranking', title: '里程碑 4：实现混合检索', fields: [retrieval, tests], artifactFiles: ['04-retrieval.mjs', 'retrieval-cases.json'], autoChecks: [jsonArrayCheck('retrieval-json', '检索案例', 'retrieval', 6, ['id', 'category', 'query', 'expectedTopIds', 'fallback'], { path: 'category', values: ['keyword', 'vector', 'hybrid', 'no-result'] }), testOutputCheck('retrieval-tests', '检索测试')], rubricFocus: ['查询处理可解释', '混合召回去重', '失败降级明确'] },
    { stageId: 'rrf-and-production', title: '里程碑 5：完成可引用问答闭环', fields: [release, tests], artifactFiles: ['05-rag-answer.mjs', 'evaluation-report.md', 'release-checklist.json'], autoChecks: [jsonObjectCheck('release-json', '发布清单', 'release', ['metrics.recallAtK', 'metrics.mrr', 'metrics.citationCoverage', 'citationPolicy.existingChunkOnly', 'budgets.p95Ms', 'degradation', 'rrf.k', 'rrf.deduplicate']), testOutputCheck('rag-tests', '端到端测试')], rubricFocus: ['答案有真实出处', '无证据时拒答', '质量延迟成本受控'] },
  ],
})
