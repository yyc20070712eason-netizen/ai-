import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { flattenCatalog, flattenChapter, getChapter } from './content/registry'
import { makeStageKey } from './content/schema'
import { createDefaultStudyState, STORAGE_KEY, STUDY_STATE_VERSION } from './lib/study'
import { ARCHIVE_VERSION } from './lib/studyArchive'
import { UI_PREFERENCES_KEY } from './lib/uiPreferences'
import { clientRelease, releaseLabel } from './release'
import type { StudyStateV4 } from './types'

function setInitialStageRoute() {
  const { chapter, stage } = flattenCatalog()[0]
  window.history.replaceState(null, '', `#/chapter/${chapter.id}/stage/${stage.id}`)
}

function openWorkspaceItem(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: '打开工作区菜单' }))
  fireEvent.click(screen.getByRole('menuitem', { name }))
}

describe('AI 学习计划', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('首次打开 Agent 知识地图，并以 v5 状态保存章节位置', async () => {
    render(<App />)

    expect(await screen.findByRole('article', { name: 'Agent 手册知识树' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agent 手册.*0%/ })).toBeInTheDocument()
    expect(screen.queryByText('章节是骨架，单元是分组')).not.toBeInTheDocument()
    expect(screen.getByText(`已完成 0 / ${flattenCatalog().length}`)).toBeInTheDocument()

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull())
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.version).toBe(5)
    expect(saved.location).toEqual({ kind: 'chapter-map', chapterId: 'agent' })
  })

  it('显示动态总进度，并让当前已完成关卡同时保留激活和完成状态', () => {
    const catalog = flattenCatalog()
    const first = catalog[0]
    const firstRef = { chapterId: first.chapter.id, stageId: first.stage.id }
    const state = createDefaultStudyState()
    state.location = { kind: 'stage', ref: firstRef }
    state.lastStageByChapter[first.chapter.id] = first.stage.id
    state.chapterOverviewSeen[first.chapter.id] = true
    state.stageProgress = Object.fromEntries(flattenChapter(first.chapter).map((item, index) => [
      makeStageKey({ chapterId: first.chapter.id, stageId: item.id }),
      { completedAt: `2026-08-18T${String(index).padStart(2, '0')}:00:00.000Z` },
    ]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    window.history.replaceState(null, '', `#/chapter/${firstRef.chapterId}/stage/${firstRef.stageId}`)

    render(<App />)

    const expectedPercent = Math.round((flattenChapter(first.chapter).length / catalog.length) * 100)
    const progress = screen.getByRole('progressbar', { name: '课程整体进度' })
    expect(progress).toHaveAttribute('aria-valuenow', String(expectedPercent))
    expect(progress).toHaveAttribute('aria-valuetext', `已完成 ${flattenChapter(first.chapter).length} / ${catalog.length}`)
    expect(screen.getByText(`已完成 ${flattenChapter(first.chapter).length} / ${catalog.length}`)).toBeInTheDocument()

    const current = screen.getByRole('button', { name: new RegExp(first.chapter.title) })
    expect(current).toHaveClass('is-active', 'is-complete')
    expect(current.querySelector('svg')).not.toBeNull()
  })

  it('学习简报读取真实目标与核心概念，并保留先判断反馈逻辑', () => {
    const { chapter, stage } = flattenCatalog()[0]
    window.history.replaceState(null, '', `#/chapter/${chapter.id}/stage/${stage.id}`)
    render(<App />)

    const goal = screen.getByRole('heading', { name: '学习目标' }).closest('section')!
    expect(within(goal).getByText(stage.outcome)).toBeInTheDocument()
    for (const concept of stage.knowledge?.keyConcepts ?? []) {
      expect(within(goal).getByText(concept)).toBeInTheDocument()
    }

    const prediction = screen.getByRole('heading', { name: '先判断' }).closest('section')!
    expect(within(prediction).getByText(stage.problem)).toBeInTheDocument()
    expect(within(prediction).getByText(stage.prediction.prompt)).toBeInTheDocument()
    fireEvent.click(within(prediction).getByRole('button', { name: new RegExp(stage.prediction.choices[0].label) }))
    expect(within(prediction).getByText(stage.prediction.feedback, { exact: false })).toBeInTheDocument()
  })

  it('切换关卡后不会残留上一关的测验答案，并支持 hash 深链', async () => {
    setInitialStageRoute()
    render(<App />)
    const firstAnswer = screen.getAllByRole('radio')[0]
    fireEvent.click(firstAnswer)
    expect(firstAnswer).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /下一关四层架构与一次数据流/ }))

    expect(screen.getByRole('heading', { level: 1, name: '四层架构与一次数据流' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/chapter/agent/stage/four-layer-architecture')
    expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
  })

  it('把第 4 关草稿保存到第 6 关里程碑，并在跨关导航后恢复', async () => {
    window.history.replaceState(null, '', '#/chapter/agent/stage/planning')
    render(<App />)

    const draft = screen.getByPlaceholderText(/确认目标与口径/)
    fireEvent.change(draft, { target: { value: '五步计划草稿：输入、动作、可观察结果。' } })
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.practiceSubmissions['agent:tools-and-react'].answers['execution-plan']).toBe('五步计划草稿：输入、动作、可观察结果。')
      expect(saved.practiceSubmissions['agent:planning']).toBeUndefined()
    })

    expect(screen.getByDisplayValue('五步计划草稿：输入、动作、可观察结果。')).toBeInTheDocument()
  })

  it('将星标题持久化到当前收藏集，并可从工作区打开所属关卡', async () => {
    setInitialStageRoute()
    render(<App />)
    const favorite = screen.getByRole('button', { name: '收藏第 1 题' })
    fireEvent.click(favorite)
    expect(favorite).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).favoriteQuestions).toHaveLength(1))
    openWorkspaceItem(/收藏/)
    expect(await screen.findByRole('heading', { level: 1, name: '收藏集' })).toBeInTheDocument()
    expect(screen.getByText('答案')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '打开所属关卡' }))
    expect(await screen.findByRole('heading', { level: 1, name: '它为什么不只是聊天' })).toBeInTheDocument()
  })

  it('从归档页打开回顾时清除旧页面状态', async () => {
    render(<App />)

    openWorkspaceItem('资料归档')
    expect(await screen.findByRole('heading', { level: 1, name: /份 AI 资料/ })).toBeInTheDocument()

    openWorkspaceItem(/回顾/)
    expect(await screen.findByRole('heading', { level: 1, name: '今天没有到期复习' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: /份 AI 资料/ })).not.toBeInTheDocument()
  })

  it('hash 深链始终从课程数据恢复准确的预测题目文本', () => {
    const target = flattenCatalog().find((item) => item.stage.title === '多意图、槽位与置信度')!
    window.history.replaceState(null, '', `#/chapter/${target.chapter.id}/stage/${target.stage.id}`)
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: '多意图、槽位与置信度' })).toBeInTheDocument()
    expect(screen.getByText('这句话应该输出什么结构？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /A\s*两个有顺序的意图及各自槽位/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /B\s*只保留最后一个意图/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /C\s*整句话作为一个工具名/ })).toBeInTheDocument()
    expect(screen.queryByText('直接让模型给出最终答案')).not.toBeInTheDocument()
  })

  it('原文弹窗始终提供外部打开入口', async () => {
    setInitialStageRoute()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /阅读原文/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Agent 手册原文' })
    expect(dialog).toHaveAttribute('open')
    const sourceLink = screen.getByRole('link', { name: /打开原文/ })
    expect(sourceLink).toHaveAttribute('href', expect.stringMatching(/^https:\/\//))
  })

  it('桌面目录可开合、保存偏好并把焦点保留在触发按钮', async () => {
    render(<App />)
    const menu = screen.getByRole('button', { name: '收起课程目录' })
    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(document.querySelector('.workspace')).toHaveClass('is-rail-collapsed')
    expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY)!)).toMatchObject({ version: 3, desktopRailOpen: false })
    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
  })

  it('设置页显示统一发布版本、构建编号和更新说明', async () => {
    render(<App />)
    openWorkspaceItem('设置')
    expect(await screen.findByRole('heading', { name: releaseLabel(clientRelease) })).toBeInTheDocument()
    expect(screen.getByText(clientRelease.highlights[0])).toBeInTheDocument()
    expect(screen.getByText(clientRelease.buildId)).toBeInTheDocument()
    expect(screen.getByText('历代版本更新')).toBeInTheDocument()
    expect(screen.getByText('v3.0.0')).toBeInTheDocument()
    expect(screen.getByText('当前版本')).toBeInTheDocument()
    expect(screen.getByText('备份格式').nextSibling).toHaveTextContent(`v${ARCHIVE_VERSION}`)
    expect(screen.getByText('本地学习状态').nextSibling).toHaveTextContent(`v${STUDY_STATE_VERSION}`)
    expect(screen.getByText(STORAGE_KEY)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`导出备份格式 v${ARCHIVE_VERSION}.*本地学习状态 v${STUDY_STATE_VERSION}`))).toBeInTheDocument()
  })

  it('设置页可检测并保存不以 sk 开头的 Chat 中转站', async () => {
    const capabilities = { authentication: 'valid' as const, text: 'chat-completions' as const, embeddings: 'unavailable' as const }
    const testResult = { keyStatus: 'valid' as const, validatedAt: '2026-08-13T00:00:00.000Z', resolvedBaseUrl: 'https://relay.example.com/v1', networkResolution: 'proxy-fake-ip' as const, models: ['relay-chat'], capabilities, canActivate: true }
    const config = {
      activeProvider: 'openai' as const,
      hasApiKey: true,
      keyStatus: 'invalid' as const,
      answerModel: 'gpt-5.6-terra',
      embeddingModel: 'text-embedding-3-small',
      capabilities: { authentication: 'unverified' as const, text: 'unavailable' as const, embeddings: 'not-tested' as const },
      providers: {
        openai: { kind: 'openai' as const, hasApiKey: true, status: { keyStatus: 'invalid' as const, models: [], capabilities: { authentication: 'invalid' as const, text: 'unavailable' as const, embeddings: 'not-tested' as const }, canActivate: false }, profile: { kind: 'openai' as const, baseUrl: 'https://api.openai.com/v1', textApi: 'responses' as const, textModel: 'gpt-5.6-terra', embeddingMode: 'enabled' as const, embeddingModel: 'text-embedding-3-small' } },
        relay: { kind: 'relay' as const, hasApiKey: false, status: null, profile: null },
      },
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      const body = path === '/api/config/provider' && init?.method === 'PUT'
        ? { ok: true, result: testResult, config: { ...config, activeProvider: 'relay', hasApiKey: true, keyStatus: 'valid', answerModel: 'relay-chat', embeddingModel: '', capabilities, providers: { ...config.providers, relay: { kind: 'relay', hasApiKey: true, status: testResult, profile: { kind: 'relay', baseUrl: 'https://relay.example.com/v1', textApi: 'auto', textModel: 'relay-chat', embeddingMode: 'disabled' } } } } }
        : path === '/api/config/provider/test'
          ? { result: testResult }
          : path === '/api/config/status'
            ? config
            : path === '/api/version'
              ? { ...clientRelease, appVersion: clientRelease.version, buildVersion: clientRelease.version, compatible: true }
              : path.startsWith('/api/archive')
                ? { records: [] }
                : path.startsWith('/api/summaries')
                  ? { summaries: [] }
                  : { documents: [] }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    openWorkspaceItem('设置')
    const dialog = await screen.findByRole('dialog', { name: '进度管理' })
    fireEvent.click(within(dialog).getByRole('radio', { name: /第三方中转站/ }))
    expect(within(dialog).getByText('当前启用：官方 OpenAI · API Key 无效，请检查对应提供商的密钥。')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Base URL'), { target: { value: 'https://relay.example.com' } })
    fireEvent.change(within(dialog).getByLabelText('文本模型'), { target: { value: 'relay-chat' } })
    fireEvent.change(within(dialog).getByLabelText('向量检索'), { target: { value: 'disabled' } })
    fireEvent.change(within(dialog).getByLabelText('中转站 API Key'), { target: { value: 'relay-token' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '测试能力' }))
    expect(await within(dialog).findByText('Chat Completions')).toBeInTheDocument()
    expect(within(dialog).getByText('不可用，使用关键词检索')).toBeInTheDocument()
    expect(within(dialog).getByText('代理 fake-IP 已安全复核')).toBeInTheDocument()
    expect(within(dialog).getByText(/本次测试.*连接可用/)).toBeInTheDocument()
    expect(within(dialog).getByText('当前启用：官方 OpenAI · API Key 无效，请检查对应提供商的密钥。')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '加密保存并启用' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/config/provider', expect.objectContaining({ method: 'PUT' })))
    const saveCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/config/provider' && init?.method === 'PUT')
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({ kind: 'relay', apiKey: 'relay-token', profile: { textApi: 'auto', textModel: 'relay-chat', embeddingMode: 'disabled' } })
  })

  it('日夜主题切换会同步根节点和持久化偏好，工作区菜单 Escape 返回焦点', async () => {
    render(<App />)
    const theme = screen.getByRole('button', { name: '切换到日间模式' })
    fireEvent.click(theme)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(theme).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY)!)).toMatchObject({ version: 3, theme: 'light' })

    const opener = screen.getByRole('button', { name: '打开工作区菜单' })
    fireEvent.click(opener)
    expect(opener).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(opener).toHaveFocus())
    expect(opener).toHaveAttribute('aria-expanded', 'false')
  })

  it('从设置返回关卡并恢复齿轮焦点，再返回知识地图', async () => {
    setInitialStageRoute()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '打开工作区菜单' }))
    const settingsButton = screen.getByRole('menuitem', { name: '设置' })
    fireEvent.click(settingsButton)
    const settingsDialog = await screen.findByRole('dialog', { name: '进度管理' })

    fireEvent.click(within(settingsDialog).getByRole('button', { name: '返回上一界面' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '进度管理' })).not.toBeInTheDocument())
    await waitFor(() => expect(settingsButton).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: '返回上一界面' }))
    expect(await screen.findByRole('article', { name: 'Agent 手册知识树' })).toBeInTheDocument()
  })

  it('直接打开关卡深链时安全返回知识地图，浏览器前进可重新进入关卡', async () => {
    const chapter = getChapter('agent')!
    const first = flattenChapter(chapter)[0]
    window.history.replaceState(null, '', `#/chapter/agent/stage/${first.id}`)
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: first.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回上一界面' }))
    expect(await screen.findByRole('article', { name: `${chapter.title}知识树` })).toBeInTheDocument()

    window.history.forward()
    expect(await screen.findByRole('heading', { level: 1, name: first.title })).toBeInTheDocument()
  })

  it('章节完成后，接下来进入下一推荐章节而不重复最后一关', () => {
    const chapter = getChapter('agent')!
    const stages = flattenChapter(chapter)
    const last = stages.at(-1)!
    const completeState: StudyStateV4 = {
      version: 4,
      location: { kind: 'stage', ref: { chapterId: chapter.id, stageId: last.id } },
      lastStageByChapter: { [chapter.id]: last.id },
      chapterOverviewSeen: { [chapter.id]: true },
      stageProgress: Object.fromEntries(stages.map((stage) => [
        makeStageKey({ chapterId: chapter.id, stageId: stage.id }),
        { completedAt: '2026-01-01T00:00:00.000Z' },
      ])),
      reviewQueue: [],
      timerMinutes: 15,
      focusSessions: [],
      favoriteQuestions: [],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completeState))
    render(<App />)

    const tools = screen.getByRole('complementary', { name: '学习工具' })
    expect(within(tools).getAllByRole('button', { name: /从补全代码到协作式开发/ })).toHaveLength(2)
    expect(within(tools).queryByRole('button', { name: new RegExp(last.title) })).not.toBeInTheDocument()
  })
})
