import { describe, expect, it } from 'vitest'
import { chapters } from '../content/registry'
import { makeStageKey } from '../content/schema'
import {
  buildKnowledgeGraph,
  chapterNodeId,
  layoutKnowledgeGraph,
  prerequisitePath,
  stageNodeId,
} from './knowledgeGraph'

function overlaps(
  left: { absoluteX: number, absoluteY: number, width: number, height: number },
  right: { absoluteX: number, absoluteY: number, width: number, height: number },
) {
  return left.absoluteX < right.absoluteX + right.width
    && left.absoluteX + left.width > right.absoluteX
    && left.absoluteY < right.absoluteY + right.height
    && left.absoluteY + left.height > right.absoluteY
}

describe('knowledge graph', () => {
  it('shows the seven-chapter network globally and expands one complete chapter without containment edges', () => {
    const global = buildKnowledgeGraph(chapters, {}, [])
    expect(global.nodes.filter((node) => node.kind === 'chapter')).toHaveLength(7)
    expect(global.nodes.filter((node) => node.kind === 'stage')).toHaveLength(0)
    expect(global.unitBands).toHaveLength(0)
    expect(global.edges.map((edge) => [edge.from, edge.to])).toEqual([
      [chapterNodeId('agent'), chapterNodeId('vibe-coding')],
      [chapterNodeId('vibe-coding'), chapterNodeId('transformer')],
      [chapterNodeId('transformer'), chapterNodeId('rag')],
      [chapterNodeId('rag'), chapterNodeId('langchain')],
      [chapterNodeId('vibe-coding'), chapterNodeId('ai-harness')],
      [chapterNodeId('agent'), chapterNodeId('langgraph')],
      [chapterNodeId('langchain'), chapterNodeId('langgraph')],
      [chapterNodeId('ai-harness'), chapterNodeId('langgraph')],
    ])

    const expanded = buildKnowledgeGraph(chapters, {}, [], 'agent')
    expect(expanded.nodes.filter((node) => node.kind === 'stage')).toHaveLength(15)
    expect(expanded.unitBands).toHaveLength(5)
    expect(expanded.edges.every((edge) => edge.kind === 'prerequisite')).toBe(true)
  })

  it('derives stage and chapter status from the existing learning state', () => {
    const first = { chapterId: 'agent', stageId: 'what-is-agent' }
    const second = { chapterId: 'agent', stageId: 'four-layer-architecture' }
    const graph = buildKnowledgeGraph(chapters, {
      [makeStageKey(first)]: { completedAt: '2026-08-01T00:00:00.000Z' },
      [makeStageKey(second)]: { firstOpenedAt: '2026-08-02T00:00:00.000Z', weak: true },
    }, [{ stage: first, dueAt: '2026-08-03T00:00:00.000Z', intervalIndex: 0 }], 'agent')

    expect(graph.nodes.find((node) => node.id === stageNodeId(first))!.state).toMatchObject({ progress: 'mastered', due: true, weak: false })
    expect(graph.nodes.find((node) => node.id === stageNodeId(second))!.state).toMatchObject({ progress: 'learning', due: false, weak: true })
    expect(graph.nodes.find((node) => node.id === chapterNodeId('agent'))!.state).toMatchObject({ progress: 'learning', due: true, weak: true })
  })

  it('uses longest-path ranks for parallel branches and direct convergence', () => {
    const graph = buildKnowledgeGraph(chapters, {}, [], 'agent')
    const layout = layoutKnowledgeGraph(graph, chapters, 'agent')
    const byId = new Map(layout.nodes.map((node) => [node.id, node]))
    const planning = byId.get(stageNodeId({ chapterId: 'agent', stageId: 'planning' }))!
    const memory = byId.get(stageNodeId({ chapterId: 'agent', stageId: 'memory' }))!
    const tools = byId.get(stageNodeId({ chapterId: 'agent', stageId: 'tools-and-react' }))!
    expect(planning.absoluteY).toBe(memory.absoluteY)
    expect(planning.absoluteY + planning.height).toBeLessThan(tools.absoluteY)
    expect(graph.edges.filter((edge) => edge.to === tools.id).map((edge) => edge.from)).toEqual([
      planning.id,
      memory.id,
    ])
  })

  it('keeps stage rectangles separate and each unit band behind all of its stages', () => {
    const graph = buildKnowledgeGraph(chapters, {}, [], 'transformer')
    const layout = layoutKnowledgeGraph(graph, chapters, 'transformer')
    const stages = layout.nodes.filter((node) => node.id.startsWith('stage:'))
    stages.forEach((stage, index) => stages.slice(index + 1).forEach((other) => expect(overlaps(stage, other)).toBe(false)))
    const byId = new Map(layout.nodes.map((node) => [node.id, node]))
    layout.unitBands.forEach((band) => band.stageNodeIds.forEach((id) => {
      const stage = byId.get(id)!
      expect(stage.absoluteX).toBeGreaterThanOrEqual(band.absoluteX)
      expect(stage.absoluteY).toBeGreaterThanOrEqual(band.absoluteY)
      expect(stage.absoluteX + stage.width).toBeLessThanOrEqual(band.absoluteX + band.width)
      expect(stage.absoluteY + stage.height).toBeLessThanOrEqual(band.absoluteY + band.height)
    }))
  })

  it('highlights the full prerequisite path and only direct successors', () => {
    const graph = buildKnowledgeGraph(chapters, {}, [], 'agent')
    const selected = stageNodeId({ chapterId: 'agent', stageId: 'tools-and-react' })
    const path = prerequisitePath(graph, selected)
    expect(path.nodeIds).toContain(stageNodeId({ chapterId: 'agent', stageId: 'what-is-agent' }))
    expect(path.nodeIds).toContain(stageNodeId({ chapterId: 'agent', stageId: 'planning' }))
    expect(path.nodeIds).toContain(stageNodeId({ chapterId: 'agent', stageId: 'stop-and-recover' }))
    expect(path.nodeIds).not.toContain(stageNodeId({ chapterId: 'agent', stageId: 'multi-agent' }))
  })
})
