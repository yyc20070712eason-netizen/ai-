import type {
  ChapterId,
  ChapterPackage,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeNodeId,
  KnowledgeNodeState,
  ReviewItem,
  StageKey,
  StageProgress,
  StageRef,
  UnitId,
} from '../types'
import { flattenChapter } from '../content/registry'
import { makeStageKey } from '../content/schema'

export type KnowledgeUnitBand = {
  id: string
  chapterId: ChapterId
  unitId: UnitId
  title: string
  stageNodeIds: KnowledgeNodeId[]
}

export type KnowledgeGraph = {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  unitBands: KnowledgeUnitBand[]
}

export type KnowledgeLayoutNode = {
  id: KnowledgeNodeId
  x: number
  y: number
  width: number
  height: number
  parentId?: KnowledgeNodeId
  absoluteX: number
  absoluteY: number
}

export type KnowledgeUnitBandLayout = KnowledgeUnitBand & {
  x: number
  y: number
  width: number
  height: number
  parentId: KnowledgeNodeId
  absoluteX: number
  absoluteY: number
}

export type KnowledgeGraphLayout = {
  nodes: KnowledgeLayoutNode[]
  unitBands: KnowledgeUnitBandLayout[]
  width: number
  height: number
}

export const COMPACT_CHAPTER_SIZE = { width: 216, height: 76 }
export const STAGE_NODE_SIZE = { width: 224, height: 80 }
const CHAPTER_HEADER_HEIGHT = 88
const STAGE_COLUMN_GAP = 48
const STAGE_RANK_GAP = 72
const CHAPTER_COLUMN_GAP = 88
const CHAPTER_RANK_GAP = 32
const CONTAINER_PADDING = 28

export function chapterNodeId(chapterId: ChapterId): KnowledgeNodeId {
  return `chapter:${chapterId}`
}

export function stageNodeId(ref: StageRef): KnowledgeNodeId {
  return `stage:${makeStageKey(ref)}`
}

function stageStateFor(stageKey: StageKey, progress: Record<StageKey, StageProgress>, due: Set<StageKey>): KnowledgeNodeState {
  const item = progress[stageKey]
  return {
    progress: item?.completedAt
      ? 'mastered'
      : item?.firstOpenedAt || item?.lastOpenedAt || item?.quizResult
        ? 'learning'
        : 'not-started',
    weak: Boolean(item?.weak),
    due: due.has(stageKey),
    justUnlocked: false,
  }
}

function aggregateState(states: KnowledgeNodeState[]): KnowledgeNodeState {
  return {
    progress: states.length > 0 && states.every((item) => item.progress === 'mastered')
      ? 'mastered'
      : states.some((item) => item.progress !== 'not-started')
        ? 'learning'
        : 'not-started',
    weak: states.some((item) => item.weak),
    due: states.some((item) => item.due),
    justUnlocked: false,
  }
}

export function buildKnowledgeGraph(
  chapters: ChapterPackage[],
  progress: Record<StageKey, StageProgress>,
  reviewQueue: ReviewItem[],
  expandedChapterId?: ChapterId,
): KnowledgeGraph {
  const due = new Set(reviewQueue.map((item) => makeStageKey(item.stage)))
  const nodes: KnowledgeNode[] = []
  const edges: KnowledgeEdge[] = []
  const unitBands: KnowledgeUnitBand[] = []

  for (const chapter of chapters) {
    const stages = flattenChapter(chapter)
    const states = stages.map((stage) => stageStateFor(makeStageKey({ chapterId: chapter.id, stageId: stage.id }), progress, due))
    const mastered = states.filter((item) => item.progress === 'mastered').length
    nodes.push({
      id: chapterNodeId(chapter.id),
      kind: 'chapter',
      chapterId: chapter.id,
      title: chapter.shortTitle,
      objective: chapter.title,
      evidence: `${mastered} / ${stages.length} 关已掌握`,
      minutes: stages.reduce((total, stage) => total + stage.durationMinutes, 0),
      state: aggregateState(states),
    })

    for (const prerequisite of chapter.prerequisites ?? []) {
      edges.push({
        id: `prerequisite:chapter:${prerequisite}:${chapter.id}`,
        from: chapterNodeId(prerequisite),
        to: chapterNodeId(chapter.id),
        kind: 'prerequisite',
      })
    }

    if (chapter.id !== expandedChapterId) continue
    for (const [stageIndex, stage] of stages.entries()) {
      const ref = { chapterId: chapter.id, stageId: stage.id }
      const key = makeStageKey(ref)
      if (!stage.knowledge) throw new Error(`知识树缺少 v2 元数据：${key}`)
      nodes.push({
        id: stageNodeId(ref),
        kind: 'stage',
        ref,
        chapterId: chapter.id,
        unitId: stage.unitId,
        title: stage.title,
        objective: stage.outcome,
        evidence: stage.practice.success,
        minutes: stage.durationMinutes,
        knowledge: stage.knowledge,
        state: stageStateFor(key, progress, due),
      })
      for (const prerequisite of stage.knowledge.prerequisites) {
        if (prerequisite.chapterId !== chapter.id) continue
        edges.push({
          id: `prerequisite:stage:${makeStageKey(prerequisite)}:${key}:${stageIndex}`,
          from: stageNodeId(prerequisite),
          to: stageNodeId(ref),
          kind: 'prerequisite',
        })
      }
    }
    unitBands.push(...chapter.units.map((unit) => ({
      id: `unit-band:${chapter.id}:${unit.id}`,
      chapterId: chapter.id,
      unitId: unit.id,
      title: unit.title,
      stageNodeIds: unit.stageIds.map((stageId) => stageNodeId({ chapterId: chapter.id, stageId })),
    })))
  }

  return { nodes, edges, unitBands }
}

function longestPathRanks(ids: KnowledgeNodeId[], edges: KnowledgeEdge[]) {
  const idSet = new Set(ids)
  const incoming = new Map<KnowledgeNodeId, KnowledgeNodeId[]>()
  ids.forEach((id) => incoming.set(id, []))
  edges.forEach((edge) => {
    if (idSet.has(edge.from) && idSet.has(edge.to)) incoming.get(edge.to)?.push(edge.from)
  })
  const ranks = new Map<KnowledgeNodeId, number>()
  const visiting = new Set<KnowledgeNodeId>()
  const rankFor = (id: KnowledgeNodeId): number => {
    const known = ranks.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) throw new Error(`知识树布局检测到循环：${id}`)
    visiting.add(id)
    const prerequisites = incoming.get(id) ?? []
    const rank = prerequisites.length === 0 ? 0 : Math.max(...prerequisites.map(rankFor)) + 1
    visiting.delete(id)
    ranks.set(id, rank)
    return rank
  }
  ids.forEach(rankFor)
  return ranks
}

function groupedByRank(
  ids: KnowledgeNodeId[],
  ranks: Map<KnowledgeNodeId, number>,
  order: Map<KnowledgeNodeId, number>,
  edges: KnowledgeEdge[],
) {
  const groups = new Map<number, KnowledgeNodeId[]>()
  ids.forEach((id) => groups.set(ranks.get(id) ?? 0, [...(groups.get(ranks.get(id) ?? 0) ?? []), id]))
  groups.forEach((group) => group.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)))
  const idSet = new Set(ids)
  const incoming = new Map<KnowledgeNodeId, KnowledgeNodeId[]>()
  const outgoing = new Map<KnowledgeNodeId, KnowledgeNodeId[]>()
  ids.forEach((id) => {
    incoming.set(id, [])
    outgoing.set(id, [])
  })
  edges.forEach((edge) => {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) return
    incoming.get(edge.to)?.push(edge.from)
    outgoing.get(edge.from)?.push(edge.to)
  })
  const rankOrder = [...groups.keys()].sort((left, right) => left - right)
  const sweep = (direction: 'forward' | 'backward') => {
    const positions = new Map<KnowledgeNodeId, number>()
    groups.forEach((group) => group.forEach((id, index) => positions.set(id, index)))
    const ranksToVisit = direction === 'forward' ? rankOrder : [...rankOrder].reverse()
    ranksToVisit.forEach((rank) => {
      const group = groups.get(rank) ?? []
      const neighbors = direction === 'forward' ? incoming : outgoing
      group.sort((left, right) => {
        const center = (id: KnowledgeNodeId) => {
          const points = (neighbors.get(id) ?? []).map((neighbor) => positions.get(neighbor)).filter((value): value is number => value !== undefined)
          return points.length ? points.reduce((total, value) => total + value, 0) / points.length : positions.get(id) ?? 0
        }
        return center(left) - center(right) || (order.get(left) ?? 0) - (order.get(right) ?? 0)
      })
      group.forEach((id, index) => positions.set(id, index))
    })
  }
  for (let pass = 0; pass < 2; pass += 1) {
    sweep('forward')
    sweep('backward')
  }
  return groups
}

function layoutExpandedChapter(chapter: ChapterPackage, graph: KnowledgeGraph) {
  const stages = flattenChapter(chapter)
  const ids = stages.map((stage) => stageNodeId({ chapterId: chapter.id, stageId: stage.id }))
  const order = new Map(ids.map((id, index) => [id, index]))
  const stageEdges = graph.edges.filter((edge) => edge.from.startsWith('stage:') && edge.to.startsWith('stage:'))
  const ranks = longestPathRanks(ids, stageEdges)
  const groups = groupedByRank(ids, ranks, order, stageEdges)
  const widestRank = Math.max(1, ...[...groups.values()].map((group) => group.length))
  const contentWidth = widestRank * STAGE_NODE_SIZE.width + (widestRank - 1) * STAGE_COLUMN_GAP
  const width = Math.max(560, contentWidth + CONTAINER_PADDING * 2)
  const nodes: KnowledgeLayoutNode[] = []

  for (const [rank, group] of groups) {
    const rowWidth = group.length * STAGE_NODE_SIZE.width + (group.length - 1) * STAGE_COLUMN_GAP
    const startX = (width - rowWidth) / 2
    group.forEach((id, index) => nodes.push({
      id,
      x: startX + index * (STAGE_NODE_SIZE.width + STAGE_COLUMN_GAP),
      y: CHAPTER_HEADER_HEIGHT + CONTAINER_PADDING + rank * (STAGE_NODE_SIZE.height + STAGE_RANK_GAP),
      width: STAGE_NODE_SIZE.width,
      height: STAGE_NODE_SIZE.height,
      parentId: chapterNodeId(chapter.id),
      absoluteX: 0,
      absoluteY: 0,
    }))
  }
  const maxBottom = Math.max(CHAPTER_HEADER_HEIGHT, ...nodes.map((node) => node.y + node.height))
  const height = maxBottom + CONTAINER_PADDING
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const unitBands = graph.unitBands.map((band): KnowledgeUnitBandLayout => {
    const members = band.stageNodeIds.map((id) => byId.get(id)).filter((item): item is KnowledgeLayoutNode => Boolean(item))
    const top = Math.min(...members.map((item) => item.y)) - 24
    const bottom = Math.max(...members.map((item) => item.y + item.height)) + 24
    return {
      ...band,
      x: 16,
      y: top,
      width: width - 32,
      height: bottom - top,
      parentId: chapterNodeId(chapter.id),
      absoluteX: 0,
      absoluteY: 0,
    }
  })
  return { width, height, nodes, unitBands }
}

export function layoutKnowledgeGraph(
  graph: KnowledgeGraph,
  chapters: ChapterPackage[],
  expandedChapterId?: ChapterId,
): KnowledgeGraphLayout {
  const chapterIds = chapters.map((chapter) => chapterNodeId(chapter.id))
  const chapterEdges = graph.edges.filter((edge) => edge.from.startsWith('chapter:') && edge.to.startsWith('chapter:'))
  const order = new Map(chapterIds.map((id, index) => [id, index]))
  const ranks = longestPathRanks(chapterIds, chapterEdges)
  const groups = groupedByRank(chapterIds, ranks, order, chapterEdges)
  const expandedChapter = chapters.find((chapter) => chapter.id === expandedChapterId)
  const internal = expandedChapter ? layoutExpandedChapter(expandedChapter, graph) : null
  const expandedNodeId = expandedChapterId ? chapterNodeId(expandedChapterId) : null
  const sizeFor = (id: KnowledgeNodeId) => id === expandedNodeId && internal
    ? { width: internal.width, height: internal.height }
    : COMPACT_CHAPTER_SIZE
  const rowWidths = [...groups.values()].map((group) => group.reduce((total, id, index) => total + sizeFor(id).width + (index ? CHAPTER_COLUMN_GAP : 0), 0))
  const width = Math.max(720, ...rowWidths) + CONTAINER_PADDING * 2
  const rankTops = new Map<number, number>()
  let nextY = CONTAINER_PADDING
  for (const rank of [...groups.keys()].sort((left, right) => left - right)) {
    rankTops.set(rank, nextY)
    const rowHeight = Math.max(...(groups.get(rank) ?? []).map((id) => sizeFor(id).height))
    nextY += rowHeight + CHAPTER_RANK_GAP
  }

  const nodes: KnowledgeLayoutNode[] = []
  for (const [rank, group] of groups) {
    const rowWidth = group.reduce((total, id, index) => total + sizeFor(id).width + (index ? CHAPTER_COLUMN_GAP : 0), 0)
    let x = (width - rowWidth) / 2
    for (const id of group) {
      const size = sizeFor(id)
      const y = rankTops.get(rank) ?? 0
      nodes.push({ id, x, y, ...size, absoluteX: x, absoluteY: y })
      if (internal && id === expandedNodeId) {
        internal.nodes.forEach((node) => nodes.push({
          ...node,
          absoluteX: x + node.x,
          absoluteY: y + node.y,
        }))
      }
      x += size.width + CHAPTER_COLUMN_GAP
    }
  }

  const expandedLayout = nodes.find((node) => node.id === expandedNodeId)
  const unitBands = internal && expandedLayout ? internal.unitBands.map((band) => ({
    ...band,
    absoluteX: expandedLayout.x + band.x,
    absoluteY: expandedLayout.y + band.y,
  })) : []
  return { nodes, unitBands, width, height: Math.max(nextY - CHAPTER_RANK_GAP + CONTAINER_PADDING, 520) }
}

export function prerequisitePath(graph: KnowledgeGraph, selectedId: KnowledgeNodeId | null) {
  if (!selectedId) return { nodeIds: new Set<KnowledgeNodeId>(), edgeIds: new Set<string>() }
  const nodeIds = new Set<KnowledgeNodeId>([selectedId])
  const edgeIds = new Set<string>()
  const visit = (id: KnowledgeNodeId) => graph.edges.forEach((edge) => {
    if (edge.to !== id || edgeIds.has(edge.id)) return
    edgeIds.add(edge.id)
    nodeIds.add(edge.from)
    visit(edge.from)
  })
  visit(selectedId)
  graph.edges.forEach((edge) => {
    if (edge.from === selectedId) {
      edgeIds.add(edge.id)
      nodeIds.add(edge.to)
    }
  })
  return { nodeIds, edgeIds }
}
