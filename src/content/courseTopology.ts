import type { ChapterId, KnowledgeDepth, StageKnowledge, StageRef } from '../types'

export const COURSE_CHAPTER_ORDER = [
  'agent',
  'vibe-coding',
  'transformer',
  'rag',
  'langchain',
  'ai-harness',
  'langgraph',
] as const

export const CHAPTER_PREREQUISITES: Record<string, ChapterId[]> = {
  agent: [],
  'vibe-coding': ['agent'],
  transformer: ['vibe-coding'],
  rag: ['transformer'],
  langchain: ['rag'],
  'ai-harness': ['vibe-coding'],
  langgraph: ['agent', 'langchain', 'ai-harness'],
}

type StageTopologySeed = readonly [
  stageId: string,
  depth: KnowledgeDepth,
  prerequisites: readonly string[],
]

const chapterStageTopology: Record<string, readonly StageTopologySeed[]> = {
  agent: [
    ['what-is-agent', 'recognize', []],
    ['four-layer-architecture', 'understand', ['what-is-agent']],
    ['model-boundaries', 'apply', ['four-layer-architecture']],
    ['planning', 'apply', ['model-boundaries']],
    ['memory', 'apply', ['model-boundaries']],
    ['tools-and-react', 'transfer', ['planning', 'memory']],
    ['stop-and-recover', 'apply', ['tools-and-react']],
    ['tool-reliability', 'apply', ['tools-and-react']],
    ['multi-agent', 'transfer', ['stop-and-recover', 'tool-reliability']],
    ['framework-choice', 'apply', ['multi-agent']],
    ['evaluation-monitoring', 'apply', ['multi-agent']],
    ['intent-recognition', 'transfer', ['framework-choice', 'evaluation-monitoring']],
    ['slots-confidence', 'apply', ['intent-recognition']],
    ['assistant-design', 'transfer', ['slots-confidence']],
    ['acceptance-iteration', 'master', ['assistant-design']],
  ],
  'vibe-coding': [
    ['vibe-mindset', 'recognize', []],
    ['choose-the-mode', 'understand', ['vibe-mindset']],
    ['editor-workspace', 'apply', ['choose-the-mode']],
    ['install-and-verify', 'apply', ['editor-workspace']],
    ['account-and-rules', 'apply', ['editor-workspace']],
    ['scaffold-fullstack', 'transfer', ['install-and-verify', 'account-and-rules']],
    ['next-edit-suggestion', 'apply', ['scaffold-fullstack']],
    ['inline-chat', 'apply', ['scaffold-fullstack']],
    ['project-context', 'transfer', ['next-edit-suggestion', 'inline-chat']],
    ['prompt-for-code', 'apply', ['project-context']],
    ['quality-gates', 'apply', ['project-context']],
    ['agent-plan-execute', 'transfer', ['prompt-for-code', 'quality-gates']],
    ['quest-and-long-tasks', 'apply', ['agent-plan-execute']],
    ['git-and-debug', 'apply', ['agent-plan-execute']],
    ['governance-and-mcp', 'master', ['quest-and-long-tasks', 'git-and-debug']],
  ],
  transformer: [
    ['why-transformer', 'recognize', []],
    ['transformer-and-llm', 'understand', ['why-transformer']],
    ['artificial-neuron', 'understand', []],
    ['activation-functions', 'apply', ['artificial-neuron']],
    ['tokens-and-embeddings', 'apply', ['transformer-and-llm']],
    ['positional-information', 'transfer', ['activation-functions', 'tokens-and-embeddings']],
    ['encoder-decoder', 'understand', ['positional-information']],
    ['encoder-block', 'apply', ['encoder-decoder']],
    ['decoder-block', 'apply', ['encoder-decoder']],
    ['attention-intuition', 'understand', ['encoder-block', 'decoder-block']],
    ['qkv-matrices', 'apply', ['attention-intuition']],
    ['scaled-dot-product', 'apply', ['qkv-matrices']],
    ['multi-head-attention', 'transfer', ['scaled-dot-product']],
    ['decoder-only', 'transfer', ['multi-head-attention']],
    ['training-and-inference', 'apply', ['decoder-only']],
    ['architecture-tradeoffs', 'master', ['training-and-inference']],
  ],
  rag: [
    ['rag-why', 'recognize', []],
    ['rag-pipeline', 'understand', ['rag-why']],
    ['rag-failure-taxonomy', 'apply', ['rag-pipeline']],
    ['data-ingestion', 'apply', ['rag-failure-taxonomy']],
    ['preprocessing', 'apply', ['data-ingestion']],
    ['chunking', 'transfer', ['preprocessing']],
    ['embeddings', 'apply', ['chunking']],
    ['vector-store', 'apply', ['embeddings']],
    ['metadata-and-provenance', 'transfer', ['chunking']],
    ['query-processing', 'apply', ['vector-store', 'metadata-and-provenance']],
    ['dense-and-hybrid', 'apply', ['query-processing']],
    ['reranking', 'transfer', ['dense-and-hybrid']],
    ['grounded-generation', 'apply', ['reranking']],
    ['postprocess-citations', 'apply', ['grounded-generation']],
    ['rag-evaluation', 'transfer', ['postprocess-citations']],
    ['multi-query', 'apply', ['reranking']],
    ['rag-fusion', 'transfer', ['multi-query']],
    ['rrf-and-production', 'master', ['rag-evaluation', 'rag-fusion']],
  ],
  langchain: [
    ['langchain-role', 'recognize', []],
    ['environment-and-model', 'apply', []],
    ['core-concepts-map', 'understand', ['langchain-role', 'environment-and-model']],
    ['prompt-template', 'apply', ['core-concepts-map']],
    ['chat-messages', 'apply', ['prompt-template']],
    ['few-shot-and-dynamic', 'transfer', ['chat-messages']],
    ['tool-contract', 'apply', ['few-shot-and-dynamic']],
    ['tool-validation', 'apply', ['tool-contract']],
    ['bind-tools', 'transfer', ['tool-validation']],
    ['agent-loop', 'understand', ['bind-tools']],
    ['multi-intent-agent', 'apply', ['agent-loop']],
    ['agent-memory', 'apply', ['agent-loop']],
    ['streaming', 'transfer', ['multi-intent-agent', 'agent-memory']],
    ['assistant-project', 'transfer', ['streaming']],
    ['langchain-production', 'master', ['assistant-project']],
  ],
  'ai-harness': [
    ['harness-mindset', 'recognize', []],
    ['prompt-context-harness', 'understand', ['harness-mindset']],
    ['vibe-coding-limits', 'apply', ['prompt-context-harness']],
    ['task-specification', 'apply', ['vibe-coding-limits']],
    ['context-selection', 'apply', ['task-specification']],
    ['tools-and-memory', 'transfer', ['context-selection']],
    ['state-and-progress', 'apply', ['tools-and-memory']],
    ['verification-loop', 'apply', ['state-and-progress']],
    ['permissions-sandbox', 'apply', ['state-and-progress']],
    ['observability', 'transfer', ['verification-loop', 'permissions-sandbox']],
    ['human-handoff', 'transfer', ['observability']],
    ['minimal-harness', 'master', ['human-handoff']],
  ],
  langgraph: [
    ['why-langgraph', 'recognize', []],
    ['langgraph-vs-langchain', 'understand', ['why-langgraph']],
    ['environment-smoke-test', 'apply', ['langgraph-vs-langchain']],
    ['state-schema', 'apply', ['environment-smoke-test']],
    ['node-contracts', 'apply', ['state-schema']],
    ['edges-and-boundaries', 'transfer', ['node-contracts']],
    ['compile-first-graph', 'apply', ['edges-and-boundaries']],
    ['reducers', 'apply', ['compile-first-graph']],
    ['conditional-routing', 'apply', ['compile-first-graph']],
    ['controlled-loops', 'transfer', ['reducers', 'conditional-routing']],
    ['messages-state', 'apply', ['controlled-loops']],
    ['chatbot-graph', 'apply', ['messages-state']],
    ['tool-node', 'transfer', ['chatbot-graph']],
    ['react-graph', 'transfer', ['tool-node']],
    ['persistence-and-resume', 'transfer', ['react-graph']],
    ['interrupt-and-production', 'master', ['persistence-and-resume']],
  ],
}

const topologyByChapter = new Map(
  Object.entries(chapterStageTopology).map(([chapterId, stages]) => [
    chapterId,
    new Map(stages.map(([stageId, depth, prerequisites]) => [stageId, { depth, prerequisites }])),
  ]),
)

export function chapterOrder(chapterId: ChapterId) {
  const index = COURSE_CHAPTER_ORDER.indexOf(chapterId as typeof COURSE_CHAPTER_ORDER[number])
  if (index < 0) throw new Error(`未配置章节顺序：${chapterId}`)
  return index + 1
}

export function stageKnowledge(
  chapterId: ChapterId,
  stageId: string,
  keyConcepts: readonly string[],
): StageKnowledge {
  const topology = topologyByChapter.get(chapterId)?.get(stageId)
  if (!topology) throw new Error(`未配置知识拓扑：${chapterId}:${stageId}`)
  return {
    depth: topology.depth,
    keyConcepts: [...keyConcepts],
    prerequisites: topology.prerequisites.map((prerequisite): StageRef => ({
      chapterId,
      stageId: prerequisite,
    })),
  }
}

export function configuredStageIds(chapterId: ChapterId) {
  return [...(topologyByChapter.get(chapterId)?.keys() ?? [])]
}
