import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType, ReactNode } from 'react'

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    Background: () => null,
    ControlButton: ({ children, ...props }: { children?: ReactNode }) => <button {...props}>{children}</button>,
    Controls: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Handle: () => null,
    MiniMap: () => null,
    ReactFlow: ({ nodes, nodeTypes, children }: {
      nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>
      nodeTypes: Record<string, ComponentType<Record<string, unknown>>>
      children?: ReactNode
    }) => (
      <div data-testid="flow-canvas">
        {nodes.map((node) => {
          const type = node.type ?? ''
          const View = nodeTypes[type]
          return View ? <View key={node.id} id={node.id} type={type} data={node.data} selected={false} dragging={false} zIndex={0} isConnectable={false} positionAbsoluteX={0} positionAbsoluteY={0} /> : null
        })}
        {children}
      </div>
    ),
  }
})

import { chapters, flattenChapter } from '../content/registry'
import { KnowledgeTree } from './KnowledgeTree'

describe('KnowledgeTree', () => {
  const first = flattenChapter(chapters[0])[0]

  afterEach(() => cleanup())

  it('点击关卡只打开详情，由进入按钮触发导航', () => {
    const chapter = chapters[0]
    const onOpenStage = vi.fn()

    render(
      <KnowledgeTree
        chapters={chapters}
        progress={{}}
        reviewQueue={[]}
        expandedChapterId={chapter.id}
        currentRef={{ chapterId: chapter.id, stageId: first.id }}
        onOpenStage={onOpenStage}
        onOpenChapter={vi.fn()}
        onOpenGlobal={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /01.*它为什么不只是聊天/ }))
    expect(screen.getByRole('complementary', { name: '关卡详情' })).toBeInTheDocument()
    expect(onOpenStage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '进入关卡' }))
    expect(onOpenStage).toHaveBeenCalledWith({ chapterId: chapter.id, stageId: first.id })
  })

  it('全局树点击章节请求展开，章节视图同时只标记一个展开节点', () => {
    const onOpenChapter = vi.fn()
    const commonProps = {
      chapters,
      progress: {},
      reviewQueue: [],
      currentRef: { chapterId: chapters[0].id, stageId: first.id },
      onOpenStage: vi.fn(),
      onOpenChapter,
      onOpenGlobal: vi.fn(),
    }
    const { rerender } = render(<KnowledgeTree {...commonProps} />)

    fireEvent.click(screen.getByRole('button', { name: /章节.*Vibe Coding/ }))
    expect(onOpenChapter).toHaveBeenCalledWith('vibe-coding')

    rerender(<KnowledgeTree {...commonProps} expandedChapterId="vibe-coding" />)
    expect(screen.getByRole('article', { name: 'Vibe Coding 全栈开发指南知识树' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /章节.*Vibe Coding/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /章节.*Agent/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('button').filter((button) => button.getAttribute('aria-expanded') === 'true')).toHaveLength(1)
  })
})
