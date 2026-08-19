import '@xyflow/react/dist/style.css'
import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'
import { ArrowRight, BookOpen, Clock3, GitBranch, LocateFixed, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildKnowledgeGraph,
  chapterNodeId,
  layoutKnowledgeGraph,
  prerequisitePath,
  stageNodeId,
} from '../lib/knowledgeGraph'
import { loadUiPreferences, saveKnowledgeTreePreferences } from '../lib/uiPreferences'
import type {
  ChapterId,
  ChapterPackage,
  KnowledgeNode,
  KnowledgeNodeId,
  ReviewItem,
  StageKey,
  StageProgress,
  StageRef,
} from '../types'

type KnowledgeTreeProps = {
  chapters: ChapterPackage[]
  progress: Record<StageKey, StageProgress>
  reviewQueue: ReviewItem[]
  expandedChapterId?: ChapterId
  currentRef: StageRef
  onOpenStage: (ref: StageRef) => void
  onOpenChapter: (chapterId: ChapterId) => void
  onOpenGlobal: () => void
}

type TreeNodeData = {
  variant: 'chapter' | 'stage' | 'unit-band'
  knowledge?: KnowledgeNode
  unitTitle?: string
  expanded?: boolean
  subdued?: boolean
  activePath?: boolean
  selected?: boolean
  stageNumber?: number
  onActivate?: () => void
}

type TreeNode = Node<TreeNodeData, 'knowledge'>

const depthLabels = {
  recognize: '识别',
  understand: '理解',
  apply: '应用',
  transfer: '迁移',
  master: '精通',
} as const

function statusLabel(node: KnowledgeNode) {
  if (node.state.due) return '待复习'
  if (node.state.weak) return '薄弱'
  if (node.state.progress === 'mastered') return '已掌握'
  if (node.state.progress === 'learning') return '学习中'
  return '未开始'
}

function nodeClass(data: TreeNodeData) {
  const node = data.knowledge
  return [
    'knowledge-node',
    `is-${data.variant}`,
    node ? `is-${node.state.progress}` : '',
    node?.state.due ? 'is-due' : '',
    node?.state.weak ? 'is-weak' : '',
    data.expanded ? 'is-expanded' : '',
    data.subdued ? 'is-subdued' : '',
    data.activePath ? 'is-path-active' : '',
    data.selected ? 'is-selected' : '',
  ].filter(Boolean).join(' ')
}

function KnowledgeNodeView({ data }: NodeProps<TreeNode>) {
  if (data.variant === 'unit-band') {
    return <div className="knowledge-unit-band"><span>{data.unitTitle}</span></div>
  }
  const node = data.knowledge!
  if (data.variant === 'chapter') {
    return (
      <div className={nodeClass(data)}>
        <Handle type="target" position={Position.Top} className="knowledge-node__handle" />
        <button type="button" className="knowledge-node__button" onClick={data.onActivate} aria-expanded={data.expanded}>
          <span className="knowledge-node__eyebrow"><BookOpen aria-hidden="true" />章节<span className="knowledge-node__status">{node.evidence}</span></span>
          <strong>{node.title}</strong>
        </button>
        <Handle type="source" position={Position.Bottom} className="knowledge-node__handle" />
      </div>
    )
  }
  const depth = node.knowledge ? depthLabels[node.knowledge.depth] : ''
  return (
    <div className={nodeClass(data)}>
      <Handle type="target" position={Position.Top} className="knowledge-node__handle" />
      <button type="button" className="knowledge-node__button" onClick={data.onActivate} aria-pressed={data.selected}>
        <span className="knowledge-node__eyebrow">
          <GitBranch aria-hidden="true" />
          <span>{String(data.stageNumber).padStart(2, '0')} · {depth}</span>
          <span className="knowledge-node__status">{statusLabel(node)}</span>
        </span>
        <strong>{node.title}</strong>
        <span className="knowledge-node__meta"><Clock3 aria-hidden="true" />{node.minutes} 分钟</span>
      </button>
      <Handle type="source" position={Position.Bottom} className="knowledge-node__handle" />
    </div>
  )
}

const nodeTypes = { knowledge: KnowledgeNodeView }

export function KnowledgeTree({
  chapters,
  progress,
  reviewQueue,
  expandedChapterId,
  currentRef,
  onOpenStage,
  onOpenChapter,
  onOpenGlobal,
}: KnowledgeTreeProps) {
  const [selectedId, setSelectedId] = useState<KnowledgeNodeId | null>(null)
  const [lowDensity, setLowDensity] = useState(false)
  const flow = useRef<ReactFlowInstance<TreeNode, Edge> | null>(null)
  const canvas = useRef<HTMLElement | null>(null)
  const chapterIds = useMemo(() => chapters.map((chapter) => chapter.id), [chapters])
  const viewportKey = expandedChapterId ?? 'global'
  const graph = useMemo(
    () => buildKnowledgeGraph(chapters, progress, reviewQueue, expandedChapterId),
    [chapters, expandedChapterId, progress, reviewQueue],
  )
  const layout = useMemo(
    () => layoutKnowledgeGraph(graph, chapters, expandedChapterId),
    [chapters, expandedChapterId, graph],
  )
  const path = useMemo(() => prerequisitePath(graph, selectedId), [graph, selectedId])
  const selected = graph.nodes.find((node) => node.id === selectedId && node.kind === 'stage') ?? null
  const stageNumbers = useMemo(() => new Map(
    expandedChapterId
      ? chapters.find((chapter) => chapter.id === expandedChapterId)?.units.flatMap((unit) => unit.stageIds).map((id, index) => [id, index + 1]) ?? []
      : [],
  ), [chapters, expandedChapterId])

  useEffect(() => {
    setSelectedId(null)
    saveKnowledgeTreePreferences(chapterIds, expandedChapterId ?? null, viewportKey)
  }, [chapterIds, expandedChapterId, viewportKey])

  const focusCurrent = useCallback((duration = 220) => {
    const instance = flow.current
    if (!instance) return
    const currentStageId = stageNodeId(currentRef)
    const target = layout.nodes.find((node) => node.id === currentStageId)
      ?? layout.nodes.find((node) => node.id === chapterNodeId(currentRef.chapterId))
      ?? layout.nodes.find((node) => node.id === chapterNodeId(expandedChapterId ?? chapters[0]?.id))
    if (!target) return
    instance.setCenter(target.absoluteX + target.width / 2, target.absoluteY + target.height / 2, { zoom: 0.9, duration })
  }, [chapters, currentRef, expandedChapterId, layout.nodes])

  const restoreViewport = useCallback((instance: ReactFlowInstance<TreeNode, Edge>) => {
    const saved = loadUiPreferences(chapterIds).knowledgeTree.viewports[viewportKey]
    const bounds = canvas.current?.getBoundingClientRect()
    const widthRatio = saved?.canvasWidth && bounds ? bounds.width / saved.canvasWidth : 1
    const heightRatio = saved?.canvasHeight && bounds ? bounds.height / saved.canvasHeight : 1
    const matchesCanvas = Boolean(
      saved?.canvasWidth
      && saved.canvasHeight
      && bounds
      && widthRatio >= 0.8
      && widthRatio <= 1.25
      && heightRatio >= 0.8
      && heightRatio <= 1.25,
    )
    if (saved && matchesCanvas) {
      void instance.setViewport(saved, { duration: 0 })
      setLowDensity(saved.zoom < 0.62)
      return
    }
    if (expandedChapterId) focusCurrent(0)
    else void instance.fitView({ padding: 0.14, minZoom: 0.5, maxZoom: 1, duration: 0 })
  }, [chapterIds, expandedChapterId, focusCurrent, viewportKey])

  useEffect(() => {
    if (!flow.current) return
    window.setTimeout(() => restoreViewport(flow.current!), 0)
  }, [restoreViewport])

  const flowNodes = useMemo<TreeNode[]>(() => {
    const domainById = new Map(graph.nodes.map((node) => [node.id, node]))
    const chapterNodes: TreeNode[] = []
    const stageNodes: TreeNode[] = []
    layout.nodes.forEach((position) => {
      const knowledge = domainById.get(position.id)
      if (!knowledge) return
      const isChapter = knowledge.kind === 'chapter'
      const expanded = isChapter && knowledge.chapterId === expandedChapterId
      const node: TreeNode = {
        id: position.id,
        type: 'knowledge',
        position: { x: position.x, y: position.y },
        style: { width: position.width, height: position.height },
        parentId: position.parentId,
        extent: position.parentId ? 'parent' : undefined,
        draggable: false,
        selectable: true,
        zIndex: isChapter ? 0 : 2,
        data: {
          variant: isChapter ? 'chapter' : 'stage',
          knowledge,
          expanded,
          subdued: Boolean(expandedChapterId && isChapter && !expanded),
          activePath: path.nodeIds.has(position.id),
          selected: selectedId === position.id,
          stageNumber: knowledge.ref ? stageNumbers.get(knowledge.ref.stageId) : undefined,
          onActivate: isChapter
            ? () => expanded ? onOpenGlobal() : onOpenChapter(knowledge.chapterId)
            : () => setSelectedId(position.id),
        },
      }
      if (isChapter) chapterNodes.push(node)
      else stageNodes.push(node)
    })
    const bands: TreeNode[] = layout.unitBands.map((band) => ({
      id: band.id,
      type: 'knowledge',
      position: { x: band.x, y: band.y },
      style: { width: band.width, height: band.height },
      parentId: band.parentId,
      extent: 'parent',
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 1,
      data: { variant: 'unit-band', unitTitle: band.title },
    }))
    return [...chapterNodes, ...bands, ...stageNodes]
  }, [expandedChapterId, graph.nodes, layout.nodes, layout.unitBands, onOpenChapter, onOpenGlobal, path.nodeIds, selectedId, stageNumbers])

  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-rule-strong)', width: 14, height: 14 },
    className: `knowledge-edge ${path.edgeIds.has(edge.id) ? 'is-path-active' : ''}`,
    zIndex: path.edgeIds.has(edge.id) ? 3 : 0,
  })), [graph.edges, path.edgeIds])

  function persistViewport(viewport: Viewport) {
    setLowDensity(viewport.zoom < 0.62)
    const bounds = canvas.current?.getBoundingClientRect()
    saveKnowledgeTreePreferences(chapterIds, expandedChapterId ?? null, viewportKey, {
      ...viewport,
      ...(bounds ? { canvasWidth: bounds.width, canvasHeight: bounds.height } : {}),
    })
  }

  return (
    <article className={`knowledge-tree ${lowDensity ? 'is-low-density' : ''}`} aria-label={expandedChapterId ? `${chapters.find((chapter) => chapter.id === expandedChapterId)?.title}知识树` : '课程知识树'}>
      <div className={`knowledge-tree__workspace ${selected ? 'has-detail' : ''}`}>
        <section ref={canvas} className="knowledge-tree__canvas" aria-label="知识树画布">
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={(instance) => { flow.current = instance; restoreViewport(instance) }}
            onMoveEnd={(_, viewport) => persistViewport(viewport)}
            minZoom={0.25}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onlyRenderVisibleElements={false}
            panOnDrag
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--color-rule)" gap={28} size={1} />
            <Controls showInteractive={false}>
              <ControlButton onClick={() => focusCurrent()} title="回到当前节点" aria-label="回到当前节点"><LocateFixed aria-hidden="true" /></ControlButton>
            </Controls>
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const data = node.data as TreeNodeData
                if (data.variant === 'unit-band') return 'var(--color-paper-3)'
                return data.knowledge?.state.progress === 'mastered' ? 'var(--color-success)' : 'var(--color-accent)'
              }}
              maskColor="var(--color-minimap-mask)"
            />
          </ReactFlow>
        </section>

        {selected && (
          <aside className="knowledge-tree__detail is-open" aria-label="关卡详情" aria-live="polite">
            <div className="knowledge-tree__detail-head">
              <span>第 {String(stageNumbers.get(selected.ref!.stageId)).padStart(2, '0')} 关</span>
              <button className="icon-button icon-button--quiet" type="button" onClick={() => setSelectedId(null)} aria-label="关闭关卡详情"><X aria-hidden="true" /></button>
            </div>
            <h2>{selected.title}</h2>
            <p className="knowledge-tree__detail-status">{statusLabel(selected)} · {selected.minutes} 分钟 · {depthLabels[selected.knowledge!.depth]}</p>
            <dl>
              <div><dt>学习目标</dt><dd>{selected.objective}</dd></div>
              <div><dt>达标证据</dt><dd>{selected.evidence}</dd></div>
              <div><dt>核心概念</dt><dd>{selected.knowledge!.keyConcepts.join(' · ')}</dd></div>
            </dl>
            <button className="button button--primary" type="button" onClick={() => onOpenStage(selected.ref!)}>
              进入关卡 <ArrowRight aria-hidden="true" />
            </button>
          </aside>
        )}
      </div>
    </article>
  )
}
