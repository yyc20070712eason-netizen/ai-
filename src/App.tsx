import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Flag,
  LibraryBig,
  LayoutGrid,
  Menu,
  Moon,
  Network,
  PenLine,
  RotateCcw,
  Search,
  Settings,
  Star,
  Sun,
  Target,
  Upload,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { FocusTimer } from './components/FocusTimer'
import { CourseSearchDialog, type CourseSearchItem } from './components/CourseSearchDialog'
import { ArchiveIndex } from './components/ArchiveIndex'
import { ConceptCheck } from './components/ConceptCheck'
import { FavoritesPanel, type FavoriteQuestionEntry } from './components/FavoritesPanel'
import { PracticeWorkbench } from './components/PracticeWorkbench'
import { ProjectStep } from './components/ProjectStep'
import { QuizPanel } from './components/QuizPanel'
import { ReviewSession, type ReviewEntry } from './components/ReviewSession'
import { SourceDialog } from './components/SourceDialog'
import { SourceWorkspace } from './components/SourceWorkspace'
import {
  flattenCatalog,
  flattenChapter,
  getAdjacentStage,
  getChapter,
  getChapterProgress,
  getChapters,
  getFirstIncompleteStage,
  getStage,
  getUnit,
  resolveStageRef,
} from './content/registry'
import { ARCHIVE_CHAPTER_ID, matchArchiveFile } from './content/archiveCatalog'
import { makeStageKey } from './content/schema'
import {
  createDefaultStudyState,
  createReviewQueue,
  dueReviews,
  focusMinutesThisWeek,
  formatFocusDuration,
  loadStudyState,
  rescheduleReview,
  saveStudyState,
  STORAGE_KEY,
  STUDY_STATE_VERSION,
} from './lib/study'
import { ARCHIVE_VERSION, createStudyArchive, parseStudyArchive } from './lib/studyArchive'
import {
  loadUiPreferences,
  saveDesktopRailPreference,
  saveThemePreference,
  type UiTheme,
} from './lib/uiPreferences'
import { allocateSectionMinutes, focusMinutesByWeekday } from './lib/uiMetrics'
import { selectSourceDocument } from './lib/sourceNavigation'
import {
  evaluateProjectPractice,
  isConceptCheckPractice,
  isProjectStepPractice,
  isProjectSubmitPractice,
  practiceAllowsMastery,
  practiceTargetRef,
} from './lib/practice'
import {
  exportWorkspace,
  deleteDocument,
  generateSummary,
  getAiConfig,
  getReleaseStatus,
  importArchivePdf,
  importWorkspace,
  listDocuments,
  listArchiveRecords,
  deleteRelayProvider,
  rebuildChapterEmbeddings,
  saveAiProvider,
  testAiProvider,
  updateArchiveStatus,
  getPracticeFeedback,
  type AiConfigStatus,
  type AiEmbeddingMode,
  type AiProviderKind,
  type AiTextApi,
  type ProviderTestResult,
  type ReleaseStatus,
} from './lib/workspace'
import { clientRelease, releaseLabel } from './release'
import type {
  ArchiveManualStatus,
  ArchiveRecord,
  ChapterPackage,
  CodexTask,
  LearningLocation,
  ProjectSubmitPractice,
  QuizResult,
  FavoriteQuestionRef,
  ReviewItem,
  StageRef,
  StageKey,
  StudyStateV5,
  WorkspaceDocument,
} from './types'

const KnowledgeTree = lazy(() => import('./components/KnowledgeTree').then((module) => ({ default: module.KnowledgeTree })))

const STAGE_HASH_PATTERN = /^#\/chapter\/([a-z0-9-]+)\/stage\/([a-z0-9-]+)$/
const CHAPTER_HASH_PATTERN = /^#\/chapter\/([a-z0-9-]+)$/
const ARCHIVE_HASH = '#/archive'
const FAVORITES_HASH = '#/favorites'
const KNOWLEDGE_TREE_HASH = '#/knowledge-tree'
const ARCHIVE_CONTEXT = { id: ARCHIVE_CHAPTER_ID, title: '资料归档' }
const APP_HISTORY_MARKER = 'ai-study'

type AppSurface =
  | { kind: 'archive' }
  | { kind: 'favorites' }
  | { kind: 'knowledge-tree' }
  | { kind: 'learning'; location: LearningLocation }
  | { kind: 'review'; items: ReviewItem[] }
  | { kind: 'local-source'; document: WorkspaceDocument }
  | { kind: 'remote-source' }
  | { kind: 'settings' }

type AppHistoryState = {
  app: typeof APP_HISTORY_MARKER
  sequence: number
  surface: AppSurface
}

function hashFor(ref: StageRef) {
  return `#/chapter/${ref.chapterId}/stage/${ref.stageId}`
}

function hashForLocation(location: LearningLocation) {
  return location.kind === 'stage' ? hashFor(location.ref) : `#/chapter/${location.chapterId}`
}

function surfaceHash(surface: AppSurface, fallbackHash = window.location.hash) {
  if (surface.kind === 'archive') return ARCHIVE_HASH
  if (surface.kind === 'favorites') return FAVORITES_HASH
  if (surface.kind === 'knowledge-tree') return KNOWLEDGE_TREE_HASH
  if (surface.kind === 'learning') return hashForLocation(surface.location)
  return fallbackHash || '#/chapter/agent'
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppHistoryState>
  return candidate.app === APP_HISTORY_MARKER
    && Number.isInteger(candidate.sequence)
    && candidate.sequence! >= 0
    && Boolean(candidate.surface && typeof candidate.surface === 'object' && 'kind' in candidate.surface)
}

function sameSurface(left: AppSurface, right: AppSurface) {
  if (left.kind !== right.kind) return false
  if (left.kind === 'learning' && right.kind === 'learning') {
    if (left.location.kind !== right.location.kind) return false
    return left.location.kind === 'chapter-map' && right.location.kind === 'chapter-map'
      ? left.location.chapterId === right.location.chapterId
      : left.location.kind === 'stage' && right.location.kind === 'stage' && refsEqual(left.location.ref, right.location.ref)
  }
  if (left.kind === 'local-source' && right.kind === 'local-source') return left.document.id === right.document.id
  return left.kind === right.kind
}

function readHash(): LearningLocation | null {
  const stageMatch = window.location.hash.match(STAGE_HASH_PATTERN)
  if (stageMatch) {
    const ref = { chapterId: stageMatch[1], stageId: stageMatch[2] }
    return getStage(ref) ? { kind: 'stage', ref } : null
  }
  const chapterMatch = window.location.hash.match(CHAPTER_HASH_PATTERN)
  if (chapterMatch && getChapter(chapterMatch[1])) return { kind: 'chapter-map', chapterId: chapterMatch[1] }
  return null
}

function refsEqual(left: StageRef, right: StageRef) {
  return left.chapterId === right.chapterId && left.stageId === right.stageId
}

function taskToText(task: CodexTask) {
  return [
    `任务：${task.title}`,
    '',
    `上下文：${task.context}`,
    `目标：${task.goal}`,
    '',
    '范围：',
    ...task.scope.map((item) => `- ${item}`),
    '',
    '约束：',
    ...task.constraints.map((item) => `- ${item}`),
    '',
    '验收标准：',
    ...task.acceptance.map((item) => `- ${item}`),
    '',
    '测试：',
    ...task.tests.map((item) => `- ${item}`),
    '',
    '请先检查当前项目，给出最小实现方案，再完成代码、测试与构建验证。',
  ].join('\n')
}

function sourceHref(chapter: ChapterPackage) {
  const source = chapter.sources[0]
  if (!source) return null
  return source.kind === 'remote' ? source.url : source.assetUrl
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function transitionTheme(update: () => void) {
  const startViewTransition = (document as Document & {
    startViewTransition?: (callback: () => void) => unknown
  }).startViewTransition
  if (!startViewTransition || prefersReducedMotion()) {
    update()
    return
  }
  startViewTransition.call(document, update)
}

function initialStudyState() {
  const stored = loadStudyState()
  const explicit = readHash()
  if (explicit) return { ...stored, location: explicit }
  if (stored.location.kind === 'chapter-map') return stored
  const chapterId = stored.location.ref.chapterId
  return stored.chapterOverviewSeen[chapterId]
    ? stored
    : { ...stored, location: { kind: 'chapter-map', chapterId } as LearningLocation }
}

function App() {
  const [study, setStudy] = useState<StudyStateV5>(initialStudyState)
  const [archiveOpen, setArchiveOpen] = useState(window.location.hash === ARCHIVE_HASH)
  const [favoritesOpen, setFavoritesOpen] = useState(window.location.hash === FAVORITES_HASH)
  const [knowledgeTreeOpen, setKnowledgeTreeOpen] = useState(window.location.hash === KNOWLEDGE_TREE_HASH)
  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([])
  const [archiveMessage, setArchiveMessage] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [mobileRailOpen, setMobileRailOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [predictions, setPredictions] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [importError, setImportError] = useState('')
  const [resetText, setResetText] = useState('')
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null)
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([])
  const [sourceDocument, setSourceDocument] = useState<WorkspaceDocument | null>(null)
  const [workspaceBusy, setWorkspaceBusy] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')
  const [aiConfig, setAiConfig] = useState<AiConfigStatus | null>(null)
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [providerKind, setProviderKind] = useState<AiProviderKind>('openai')
  const [relayBaseUrl, setRelayBaseUrl] = useState('')
  const [relayTextApi, setRelayTextApi] = useState<AiTextApi>('auto')
  const [relayTextModel, setRelayTextModel] = useState('')
  const [relayEmbeddingMode, setRelayEmbeddingMode] = useState<AiEmbeddingMode>('auto')
  const [relayEmbeddingModel, setRelayEmbeddingModel] = useState('')
  const [providerTest, setProviderTest] = useState<ProviderTestResult | null>(null)
  const [providerMessage, setProviderMessage] = useState('')
  const chapterIds = useMemo(() => getChapters().map((item) => item.id), [])
  const initialUiPreferences = useRef(loadUiPreferences(chapterIds)).current
  const [theme, setTheme] = useState<UiTheme>(initialUiPreferences.theme)
  const [desktopRailOpen, setDesktopRailOpen] = useState(initialUiPreferences.desktopRailOpen)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [activeLessonIndex, setActiveLessonIndex] = useState(0)
  const [noteSaveStatus, setNoteSaveStatus] = useState<'saved' | 'saving'>('saved')
  const menuButton = useRef<HTMLButtonElement>(null)
  const workspaceMenuButton = useRef<HTMLButtonElement>(null)
  const workspaceMenu = useRef<HTMLDivElement>(null)
  const searchButton = useRef<HTMLButtonElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const apiKeyInput = useRef<HTMLInputElement>(null)
  const focusApiKeyOnSettingsOpen = useRef(false)
  const sourceDialog = useRef<HTMLDialogElement>(null)
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const studyRef = useRef(study)
  const noteSaveTimer = useRef<number | null>(null)
  const historySequence = useRef(0)
  const activeSurface = useRef<AppSurface>(
    window.location.hash === ARCHIVE_HASH
      ? { kind: 'archive' }
      : window.location.hash === FAVORITES_HASH
        ? { kind: 'favorites' }
      : window.location.hash === KNOWLEDGE_TREE_HASH
        ? { kind: 'knowledge-tree' }
      : { kind: 'learning', location: study.location },
  )
  const surfaceOpeners = useRef(new Map<number, HTMLElement>())
  const applySurfaceRef = useRef<(surface: AppSurface) => void>(() => undefined)
  studyRef.current = study

  const locationChapterId = study.location.kind === 'stage' ? study.location.ref.chapterId : study.location.chapterId
  const locationChapter = getChapter(locationChapterId) ?? getChapters()[0]
  const rememberedStageId = study.lastStageByChapter[locationChapter.id]
  const fallbackRef = rememberedStageId && getStage({ chapterId: locationChapter.id, stageId: rememberedStageId })
    ? { chapterId: locationChapter.id, stageId: rememberedStageId }
    : { chapterId: locationChapter.id, stageId: flattenChapter(locationChapter)[0].id }
  const currentRef = resolveStageRef(study.location.kind === 'stage' ? study.location.ref : fallbackRef)
  const chapter = getChapter(currentRef.chapterId) ?? getChapters()[0]
  const stage = getStage(currentRef) ?? flattenChapter(chapter)[0]
  const unit = getUnit(currentRef) ?? chapter.units[0]
  const stageKey = makeStageKey(currentRef)
  const practiceKey = makeStageKey(practiceTargetRef(currentRef, stage.practice))
  const currentSubmitPractice = isProjectSubmitPractice(stage.practice) ? stage.practice : undefined
  const progressForStage = study.stageProgress[stageKey]
  const stageSourceDocument = useMemo(
    () => selectSourceDocument(documents, stage.sourceRefs),
    [documents, stage.sourceRefs],
  )
  const completedKeys = useMemo(
    () => new Set(
      Object.entries(study.stageProgress)
        .filter(([, progress]) => Boolean(progress.completedAt))
        .map(([key]) => key),
    ),
    [study.stageProgress],
  )
  const chapterProgress = getChapterProgress(chapter.id, completedKeys)
  const orderedStages = flattenCatalog()
  const courseTotal = orderedStages.length
  const masteredTotal = orderedStages.filter(({ chapter: itemChapter, stage: itemStage }) => (
    completedKeys.has(makeStageKey({ chapterId: itemChapter.id, stageId: itemStage.id }))
  )).length
  const overallProgress = courseTotal ? Math.round((masteredTotal / courseTotal) * 100) : 0
  const weeklyFocusTime = formatFocusDuration(focusMinutesThisWeek(study.focusSessions))
  const weeklyMinutes = useMemo(() => focusMinutesByWeekday(study.focusSessions), [study.focusSessions])
  const weeklyPeak = Math.max(...weeklyMinutes, 1)
  const courseSearchItems = useMemo<CourseSearchItem[]>(() => orderedStages.map(({ chapter: itemChapter, stage: itemStage }) => ({
    ref: { chapterId: itemChapter.id, stageId: itemStage.id },
    chapterTitle: itemChapter.shortTitle,
    unitTitle: itemChapter.units.find((candidate) => candidate.id === itemStage.unitId)?.title ?? '',
    title: itemStage.title,
    outcome: itemStage.outcome,
    concepts: itemStage.knowledge?.keyConcepts ?? [],
  })), [orderedStages])
  const stageNumber = flattenChapter(chapter).findIndex((item) => item.id === stage.id) + 1
  const sectionMinutes = useMemo(() => allocateSectionMinutes(
    stage.durationMinutes,
    stage.lesson.map((block) => block.title.length
      + block.paragraphs.reduce((total, paragraph) => total + paragraph.length, 0)
      + (block.points?.reduce((total, point) => total + point.length, 0) ?? 0)),
  ), [stage])
  const firstIncomplete = getFirstIncompleteStage(chapter.id, completedKeys)
  const currentFlatIndex = orderedStages.findIndex(
    ({ chapter: itemChapter, stage: itemStage }) => (
      itemChapter.id === currentRef.chapterId && itemStage.id === currentRef.stageId
    ),
  )
  const firstIncompleteIndex = firstIncomplete
    ? orderedStages.findIndex(
      ({ chapter: itemChapter, stage: itemStage }) => (
        itemChapter.id === firstIncomplete.chapterId && itemStage.id === firstIncomplete.stageId
      ),
    )
    : -1
  const isPreviewingAhead = firstIncompleteIndex >= 0 && currentFlatIndex > firstIncompleteIndex
  const prediction = predictions[stageKey]
  const previousRef = getAdjacentStage(currentRef, 'previous')
  const nextRef = getAdjacentStage(currentRef, 'next')
  const currentChapterStages = flattenChapter(chapter)
  const isLastInChapter = currentChapterStages.at(-1)?.id === stage.id
  const chapterLastStage = currentChapterStages.at(-1)
  const afterCurrentChapter = chapterLastStage
    ? getAdjacentStage({ chapterId: chapter.id, stageId: chapterLastStage.id }, 'next')
    : null

  const dueItems = useMemo(() => {
    const unique = new Map<string, ReviewItem>()
    for (const item of dueReviews(study.reviewQueue)) {
      const key = makeStageKey(item.stage)
      if (!unique.has(key) && getStage(item.stage)) unique.set(key, item)
    }
    return [...unique.values()]
      .sort((left, right) => {
        const overdue = Date.parse(left.dueAt) - Date.parse(right.dueAt)
        if (overdue !== 0) return overdue
        const leftWeak = study.stageProgress[makeStageKey(left.stage)]?.weak ? 0 : 1
        const rightWeak = study.stageProgress[makeStageKey(right.stage)]?.weak ? 0 : 1
        return leftWeak - rightWeak || left.intervalIndex - right.intervalIndex
      })
      .slice(0, 5)
  }, [study.reviewQueue, study.stageProgress])

  const reviewEntries = useMemo<ReviewEntry[]>(() => (
    (reviewItems ?? []).flatMap((item) => {
      const itemChapter = getChapter(item.stage.chapterId)
      const itemStage = getStage(item.stage)
      if (!itemChapter || !itemStage) return []
      return [{
        item,
        chapter: itemChapter,
        stage: itemStage,
        progress: study.stageProgress[makeStageKey(item.stage)],
      }]
    })
  ), [reviewItems, study.stageProgress])

  const favoriteEntries = useMemo<FavoriteQuestionEntry[]>(() => (
    study.favoriteQuestions.map((favorite) => {
      const favoriteChapter = getChapter(favorite.stage.chapterId)
      const favoriteStage = getStage(favorite.stage)
      return {
        favorite,
        chapter: favoriteChapter,
        stage: favoriteStage,
        question: favoriteStage?.quiz.find((question) => question.id === favorite.questionId),
      }
    }).sort((left, right) => {
      const leftChapterOrder = left.chapter?.order ?? Number.MAX_SAFE_INTEGER
      const rightChapterOrder = right.chapter?.order ?? Number.MAX_SAFE_INTEGER
      if (leftChapterOrder !== rightChapterOrder) return leftChapterOrder - rightChapterOrder
      const leftStageOrder = left.chapter && left.stage ? flattenChapter(left.chapter).findIndex((stageItem) => stageItem.id === left.stage?.id) : Number.MAX_SAFE_INTEGER
      const rightStageOrder = right.chapter && right.stage ? flattenChapter(right.chapter).findIndex((stageItem) => stageItem.id === right.stage?.id) : Number.MAX_SAFE_INTEGER
      return leftStageOrder - rightStageOrder || Date.parse(left.favorite.savedAt) - Date.parse(right.favorite.savedAt)
    })
  ), [study.favoriteQuestions])

  const currentFavoriteQuestionIds = useMemo(() => new Set(
    study.favoriteQuestions
      .filter((favorite) => refsEqual(favorite.stage, currentRef))
      .map((favorite) => favorite.questionId),
  ), [currentRef, study.favoriteQuestions])

  const nextTasks = useMemo(() => {
    const tasks: Array<{ key: string; label: string; meta: string; done: boolean; action: () => void }> = []
    if (dueItems.length > 0) {
      tasks.push({
        key: 'reviews',
        label: `到期复习 ${dueItems.length} 关`,
        meta: '约 5 分钟',
        done: false,
        action: () => openReview(dueItems),
      })
    }

    const nextChapterRef = afterCurrentChapter
      ? getFirstIncompleteStage(afterCurrentChapter.chapterId, completedKeys) ?? afterCurrentChapter
      : null
    const learningRef = firstIncomplete ?? nextChapterRef
    const learningStage = learningRef ? getStage(learningRef) : null
    if (learningRef && learningStage) {
      const key = makeStageKey(learningRef)
      tasks.push({
        key,
        label: learningStage.title,
        meta: `${learningStage.durationMinutes} 分钟`,
        done: completedKeys.has(key),
        action: () => navigate(learningRef),
      })
      const afterLearning = getAdjacentStage(learningRef, 'next')
      const afterStage = afterLearning ? getStage(afterLearning) : null
      if (afterLearning && afterStage) {
        const nextKey = makeStageKey(afterLearning)
        tasks.push({
          key: nextKey,
          label: afterStage.title,
          meta: afterLearning.chapterId === learningRef.chapterId ? '随后学习' : `进入 ${getChapter(afterLearning.chapterId)?.shortTitle ?? '下一章'}`,
          done: completedKeys.has(nextKey),
          action: () => navigate(afterLearning),
        })
      }
    }
    return tasks.filter((task, index, all) => all.findIndex((item) => item.key === task.key) === index).slice(0, 3)
    // navigate is stable enough for these short-lived task callbacks; all data dependencies are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterCurrentChapter, completedKeys, dueItems, firstIncomplete])

  function routeSurfaceFromHash(): AppSurface {
    if (window.location.hash === ARCHIVE_HASH) return { kind: 'archive' }
    if (window.location.hash === FAVORITES_HASH) return { kind: 'favorites' }
    if (window.location.hash === KNOWLEDGE_TREE_HASH) return { kind: 'knowledge-tree' }
    return { kind: 'learning', location: readHash() ?? studyRef.current.location }
  }

  function applySurface(surface: AppSurface) {
    activeSurface.current = surface
    setMobileRailOpen(false)

    if (surface.kind !== 'settings' && settingsDialog.current?.open) settingsDialog.current.close()
    if (surface.kind !== 'remote-source' && sourceDialog.current?.open) sourceDialog.current.close()

    if (surface.kind === 'settings') {
      setReviewItems(null)
      setSourceDocument(null)
      window.setTimeout(() => {
        if (!settingsDialog.current?.open) settingsDialog.current?.showModal()
        if (focusApiKeyOnSettingsOpen.current) {
          focusApiKeyOnSettingsOpen.current = false
          apiKeyInput.current?.focus()
        }
      }, 0)
      return
    }
    if (surface.kind === 'remote-source') {
      setReviewItems(null)
      setSourceDocument(null)
      window.setTimeout(() => {
        if (!sourceDialog.current?.open) sourceDialog.current?.showModal()
      }, 0)
      return
    }
    if (surface.kind === 'review') {
      setArchiveOpen(false)
      setFavoritesOpen(false)
      setKnowledgeTreeOpen(false)
      setReviewItems(surface.items)
      setSourceDocument(null)
      return
    }
    if (surface.kind === 'local-source') {
      setReviewItems(null)
      setSourceDocument(surface.document)
      return
    }

    setReviewItems(null)
    setSourceDocument(null)
    if (surface.kind === 'knowledge-tree') {
      setArchiveOpen(false)
      setFavoritesOpen(false)
      setKnowledgeTreeOpen(true)
      return
    }
    if (surface.kind === 'archive') {
      setFavoritesOpen(false)
      setKnowledgeTreeOpen(false)
      setArchiveOpen(true)
      return
    }

    if (surface.kind === 'favorites') {
      setArchiveOpen(false)
      setKnowledgeTreeOpen(false)
      setFavoritesOpen(true)
      return
    }

    const location = surface.location
    setArchiveOpen(false)
    setFavoritesOpen(false)
    setKnowledgeTreeOpen(false)
    setStudy((current) => ({
      ...current,
      location,
      ...(location.kind === 'chapter-map' ? {
        chapterOverviewSeen: { ...current.chapterOverviewSeen, [location.chapterId]: true },
      } : {
        lastStageByChapter: { ...current.lastStageByChapter, [location.ref.chapterId]: location.ref.stageId },
      }),
    }))
  }

  applySurfaceRef.current = applySurface

  function pushSurface(surface: AppSurface, opener?: HTMLElement | null) {
    if (sameSurface(activeSurface.current, surface)) return
    const nextSequence = historySequence.current + 1
    if (opener) surfaceOpeners.current.set(nextSequence, opener)
    window.history.pushState(
      { app: APP_HISTORY_MARKER, sequence: nextSequence, surface } satisfies AppHistoryState,
      '',
      surfaceHash(surface),
    )
    historySequence.current = nextSequence
    applySurface(surface)
  }

  function replaceSurface(surface: AppSurface) {
    window.history.replaceState(
      { app: APP_HISTORY_MARKER, sequence: historySequence.current, surface } satisfies AppHistoryState,
      '',
      surfaceHash(surface),
    )
    applySurface(surface)
  }

  function fallbackSurface(): AppSurface {
    const current = activeSurface.current
    if (current.kind === 'learning') {
      return current.location.kind === 'stage'
        ? { kind: 'learning', location: { kind: 'chapter-map', chapterId: current.location.ref.chapterId } }
        : { kind: 'archive' }
    }
    if (current.kind === 'archive') return { kind: 'learning', location: studyRef.current.location }
    if (current.kind === 'favorites') return { kind: 'archive' }
    if (current.kind === 'knowledge-tree') return { kind: 'learning', location: studyRef.current.location }
    return routeSurfaceFromHash()
  }

  function goBack() {
    if (historySequence.current > 0) {
      window.history.back()
      return
    }
    replaceSurface(fallbackSurface())
  }

  function openSettings(opener?: HTMLElement | null, focusApiKey = false) {
    if (focusApiKey) focusApiKeyOnSettingsOpen.current = true
    pushSurface({ kind: 'settings' }, opener ?? document.activeElement as HTMLElement | null)
  }

  function openRemoteSource(opener?: HTMLElement | null) {
    pushSurface({ kind: 'remote-source' }, opener ?? document.activeElement as HTMLElement | null)
  }

  function openReview(items: ReviewItem[], opener?: HTMLElement | null) {
    pushSurface({ kind: 'review', items }, opener ?? document.activeElement as HTMLElement | null)
  }

  function scrollToLessonSection(id: string) {
    if (study.location.kind !== 'stage') navigate(currentRef)
    window.setTimeout(() => {
      const target = document.getElementById(id)
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
      target?.focus({ preventScroll: true })
    }, 0)
  }

  function scrollToLessonBlock(index: number) {
    const target = document.getElementById(`lesson-section-${index}`)
    target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
    target?.focus({ preventScroll: true })
  }

  function openLocalSource(documentItem: WorkspaceDocument, opener?: HTMLElement | null) {
    pushSurface({ kind: 'local-source', document: documentItem }, opener ?? document.activeElement as HTMLElement | null)
  }

  useEffect(() => {
    saveStudyState(study)
  }, [study])

  useEffect(() => () => {
    if (noteSaveTimer.current !== null) window.clearTimeout(noteSaveTimer.current)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    if (!workspaceMenuOpen) return
    const dismiss = (event: PointerEvent) => {
      if (workspaceMenu.current?.contains(event.target as Node) || workspaceMenuButton.current?.contains(event.target as Node)) return
      setWorkspaceMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setWorkspaceMenuOpen(false)
      window.setTimeout(() => workspaceMenuButton.current?.focus(), 0)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [workspaceMenuOpen])

  useEffect(() => {
    setActiveLessonIndex(0)
    if (study.location.kind !== 'stage' || typeof IntersectionObserver === 'undefined') return
    const sections = [...document.querySelectorAll<HTMLElement>('[data-lesson-section]')]
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0]
      if (!visible) return
      const next = Number((visible.target as HTMLElement).dataset.lessonSection)
      if (Number.isInteger(next)) setActiveLessonIndex(next)
    }, { rootMargin: '-18% 0px -62% 0px', threshold: [0, 0.2, 0.8] })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [stageKey, study.location.kind])

  useEffect(() => {
    if (!aiConfig) return
    setProviderKind(aiConfig.activeProvider)
    const relay = aiConfig.providers.relay.profile
    if (!relay) return
    setRelayBaseUrl(relay.baseUrl)
    setRelayTextApi(relay.textApi)
    setRelayTextModel(relay.textModel)
    setRelayEmbeddingMode(relay.embeddingMode)
    setRelayEmbeddingModel(relay.embeddingModel || '')
  }, [aiConfig])

  useEffect(() => {
    let active = true
    Promise.all([
      listDocuments(chapter.id),
      getAiConfig(),
      getReleaseStatus(),
    ]).then(([nextDocuments, config, nextRelease]) => {
      if (!active) return
      setDocuments(nextDocuments)
      setAiConfig(config)
      setReleaseStatus(nextRelease)
      setWorkspaceError('')
    }).catch(() => {
      if (!active) return
      setDocuments([])
      setReleaseStatus(null)
      setWorkspaceError('本地资料服务尚未启动。请从桌面快捷方式重新打开应用。')
    })
    return () => { active = false }
  }, [chapter.id])

  useEffect(() => {
    let active = true
    listArchiveRecords().then((records) => {
      if (!active) return
      setArchiveRecords(records)
      setArchiveError('')
    }).catch((reason: unknown) => {
      if (!active) return
      setArchiveError(reason instanceof Error ? reason.message : '本地归档服务尚未启动。')
    })
    return () => { active = false }
  }, [archiveOpen])

  useEffect(() => {
    const existing = window.history.state
    if (isAppHistoryState(existing)) {
      historySequence.current = existing.sequence
      applySurfaceRef.current(existing.surface)
    } else {
      const surface = activeSurface.current
      const fallback = fallbackSurface()
      window.history.replaceState(
        { app: APP_HISTORY_MARKER, sequence: 0, surface: fallback } satisfies AppHistoryState,
        '',
        surfaceHash(fallback),
      )
      window.history.pushState(
        { app: APP_HISTORY_MARKER, sequence: 1, surface } satisfies AppHistoryState,
        '',
        surfaceHash(surface),
      )
      historySequence.current = 1
    }

    const handlePopState = (event: PopStateEvent) => {
      const leavingSequence = historySequence.current
      const state = isAppHistoryState(event.state)
        ? event.state
        : { app: APP_HISTORY_MARKER, sequence: 0, surface: fallbackSurface() } satisfies AppHistoryState
      if (!isAppHistoryState(event.state)) {
        window.history.replaceState(state, '', surfaceHash(state.surface))
      }
      historySequence.current = state.sequence
      applySurfaceRef.current(state.surface)
      if (state.sequence < leavingSequence) {
        const opener = surfaceOpeners.current.get(leavingSequence)
        surfaceOpeners.current.delete(leavingSequence)
        if (opener?.isConnected) window.setTimeout(() => opener.focus(), 0)
      }
    }
    const handleHashChange = () => {
      const surface = routeSurfaceFromHash()
      window.history.replaceState(
        { app: APP_HISTORY_MARKER, sequence: historySequence.current, surface } satisfies AppHistoryState,
        '',
        surfaceHash(surface),
      )
      applySurfaceRef.current(surface)
    }
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.key !== 'ArrowLeft') return
      event.preventDefault()
      goBack()
    }
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('keydown', handleHistoryShortcut)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('keydown', handleHistoryShortcut)
    }
    // Event handlers read the latest callbacks through applySurfaceRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mobileRailOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileRailOpen(false)
      window.setTimeout(() => menuButton.current?.focus(), 0)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [mobileRailOpen])

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setSearchOpen(true)
    }
    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  useEffect(() => {
    if (archiveOpen) {
      document.title = `资料归档 · AI 学习计划 ${releaseLabel(clientRelease)}`
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    if (favoritesOpen) {
      document.title = `收藏集 · AI 学习计划 ${releaseLabel(clientRelease)}`
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    if (knowledgeTreeOpen) {
      document.title = `知识树 · AI 学习计划 ${releaseLabel(clientRelease)}`
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    document.title = study.location.kind === 'chapter-map'
      ? `${chapter.title} 知识地图 · AI 学习计划 ${releaseLabel(clientRelease)}`
      : `${stage.title} · AI 学习计划 ${releaseLabel(clientRelease)}`
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [archiveOpen, favoritesOpen, knowledgeTreeOpen, chapter.title, stage.title, study.location])

  function navigate(ref: StageRef) {
    if (!getStage(ref)) return
    const now = new Date().toISOString()
    const key = makeStageKey(ref)
    setStudy((current) => ({
      ...current,
      stageProgress: {
        ...current.stageProgress,
        [key]: {
          ...current.stageProgress[key],
          firstOpenedAt: current.stageProgress[key]?.firstOpenedAt ?? now,
          lastOpenedAt: now,
        },
      },
    }))
    pushSurface({ kind: 'learning', location: { kind: 'stage', ref } })
  }

  function openChapterMap(chapterId = chapter.id) {
    if (!getChapter(chapterId)) return
    pushSurface({ kind: 'learning', location: { kind: 'chapter-map', chapterId } })
  }

  function openKnowledgeTree() {
    pushSurface({ kind: 'knowledge-tree' })
  }

  function openArchive() {
    pushSurface({ kind: 'archive' })
  }

  function openFavorites(opener?: HTMLElement | null) {
    pushSurface({ kind: 'favorites' }, opener ?? document.activeElement as HTMLElement | null)
  }

  function toggleFavorite(questionId: string) {
    const favorite: FavoriteQuestionRef = { stage: currentRef, questionId, savedAt: new Date().toISOString() }
    setStudy((current) => {
      const exists = current.favoriteQuestions.some((item) => refsEqual(item.stage, favorite.stage) && item.questionId === questionId)
      return {
        ...current,
        favoriteQuestions: exists
          ? current.favoriteQuestions.filter((item) => !refsEqual(item.stage, favorite.stage) || item.questionId !== questionId)
          : [...current.favoriteQuestions, favorite],
      }
    })
  }

  function removeFavorite(favorite: FavoriteQuestionRef) {
    setStudy((current) => ({
      ...current,
      favoriteQuestions: current.favoriteQuestions.filter((item) => !refsEqual(item.stage, favorite.stage) || item.questionId !== favorite.questionId),
    }))
  }

  function closeMobileRail() {
    setMobileRailOpen(false)
    window.setTimeout(() => menuButton.current?.focus(), 0)
  }

  function toggleCourseRail() {
    if (window.innerWidth < 1024) {
      setMobileRailOpen((current) => !current)
      return
    }
    setDesktopRailOpen((current) => {
      const next = !current
      saveDesktopRailPreference(next, chapterIds)
      return next
    })
  }

  function toggleTheme() {
    const next: UiTheme = theme === 'dark' ? 'light' : 'dark'
    transitionTheme(() => {
      document.documentElement.dataset.theme = next
      document.documentElement.style.colorScheme = next
      setTheme(next)
      saveThemePreference(next, chapterIds)
    })
  }

  function closeWorkspaceMenu() {
    setWorkspaceMenuOpen(false)
  }

  function markNoteSaving() {
    setNoteSaveStatus('saving')
    if (noteSaveTimer.current !== null) window.clearTimeout(noteSaveTimer.current)
    noteSaveTimer.current = window.setTimeout(() => setNoteSaveStatus('saved'), 450)
  }

  function handleQuizResult(result: QuizResult) {
    const answeredRef = currentRef
    const answeredKey = makeStageKey(answeredRef)
    setStudy((current) => {
      const previous = current.stageProgress[answeredKey]
      const otherReviews = current.reviewQueue.filter(
        (item) => makeStageKey(item.stage) !== answeredKey,
      )
      const practiceMeets = practiceAllowsMastery(stage.practice, current.practiceSubmissions[answeredKey])
      const shouldMaster = result.passed && practiceMeets
      const alreadyMastered = Boolean(previous?.completedAt)
      return {
        ...current,
        stageProgress: {
          ...current.stageProgress,
          [answeredKey]: {
            ...previous,
            quizResult: result,
            ...(shouldMaster ? { completedAt: previous?.completedAt ?? result.answeredAt, weak: false } : result.passed ? { weak: false } : { weak: true }),
          },
        },
        reviewQueue: shouldMaster && !alreadyMastered
          ? [...otherReviews, ...createReviewQueue(answeredRef, new Date(result.answeredAt))]
          : current.reviewQueue,
      }
    })
  }

  function savePracticeDraft(targetKey: StageKey, answers: Record<string, string>) {
    setStudy((current) => {
      const previous = current.practiceSubmissions[targetKey]
      return { ...current, practiceSubmissions: { ...current.practiceSubmissions, [targetKey]: {
        answers, checkedRubricIds: previous?.checkedRubricIds ?? [], draftUpdatedAt: new Date().toISOString(), submittedAt: previous?.submittedAt, revisionCount: previous?.revisionCount ?? 0, feedback: previous?.feedback,
      } } }
    })
  }

  function togglePracticeRubric(targetKey: StageKey, id: string) {
    setStudy((current) => {
      const previous = current.practiceSubmissions[targetKey] ?? { answers: {}, checkedRubricIds: [], draftUpdatedAt: new Date().toISOString(), revisionCount: 0 }
      const checkedRubricIds = previous.checkedRubricIds.includes(id) ? previous.checkedRubricIds.filter((item) => item !== id) : [...previous.checkedRubricIds, id]
      return { ...current, practiceSubmissions: { ...current.practiceSubmissions, [targetKey]: { ...previous, checkedRubricIds, draftUpdatedAt: new Date().toISOString() } } }
    })
  }

  function submitPractice(targetKey: StageKey, practice: ProjectSubmitPractice) {
    setStudy((current) => {
      const previous = current.practiceSubmissions[targetKey]
      if (!previous) return current
      const now = new Date().toISOString()
      const submitted = { ...previous, submittedAt: now, draftUpdatedAt: now, revisionCount: previous.submittedAt ? previous.revisionCount + 1 : previous.revisionCount }
      const evaluation = evaluateProjectPractice(practice, submitted)
      const quizPassed = current.stageProgress[targetKey]?.quizResult?.passed
      const alreadyMastered = Boolean(current.stageProgress[targetKey]?.completedAt)
      const shouldMaster = quizPassed && evaluation.state === 'meets' && !alreadyMastered
      return {
        ...current,
        practiceSubmissions: { ...current.practiceSubmissions, [targetKey]: submitted },
        stageProgress: shouldMaster
          ? { ...current.stageProgress, [targetKey]: { ...current.stageProgress[targetKey], completedAt: now, weak: false } }
          : quizPassed && !alreadyMastered
            ? { ...current.stageProgress, [targetKey]: { ...current.stageProgress[targetKey], weak: evaluation.state !== 'meets' } }
            : current.stageProgress,
        reviewQueue: shouldMaster ? [...current.reviewQueue.filter((item) => makeStageKey(item.stage) !== targetKey), ...createReviewQueue(currentRef, new Date(now))] : current.reviewQueue,
      }
    })
  }

  async function requestPracticeFeedback(practice: ProjectSubmitPractice, targetKey: StageKey) {
    const submission = study.practiceSubmissions[targetKey]
    if (!submission?.submittedAt) return
    setWorkspaceBusy('practice-feedback')
    setWorkspaceError('')
    try {
      const feedback = await getPracticeFeedback({ stageKey: targetKey, title: practice.title, brief: practice.brief, rubric: practice.rubric, answers: submission.answers })
      setStudy((current) => ({ ...current, practiceSubmissions: { ...current.practiceSubmissions, [targetKey]: { ...current.practiceSubmissions[targetKey], feedback } } }))
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : 'AI 点评暂时不可用，请稍后重试。')
    } finally { setWorkspaceBusy('') }
  }

  function handleFocusComplete(minutes: number) {
    setStudy((current) => ({
      ...current,
      focusSessions: [
        ...current.focusSessions,
        { stage: currentRef, completedAt: new Date().toISOString(), minutes },
      ],
    }))
  }

  function handleReviewAnswer(entry: ReviewEntry, correct: boolean) {
    const key = makeStageKey(entry.item.stage)
    setStudy((current) => ({
      ...current,
      reviewQueue: rescheduleReview(current.reviewQueue, entry.item, correct),
      stageProgress: {
        ...current.stageProgress,
        [key]: {
          ...current.stageProgress[key],
          weak: !correct,
        },
      },
    }))
  }

  async function copyTask() {
    if (!stage.codexTask) return
    await navigator.clipboard.writeText(taskToText(stage.codexTask))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }

  async function exportProgress() {
    let workspace: Record<string, unknown> | undefined
    try { workspace = await exportWorkspace() } catch { /* progress export remains available offline */ }
    const blob = new Blob([JSON.stringify(createStudyArchive(study, workspace), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ai-study-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importProgress(file?: File) {
    if (!file) return
    try {
      const archive = parseStudyArchive(JSON.parse(await file.text()))
      if (!archive) throw new Error('invalid progress')
      if (archive.workspace) await importWorkspace(archive.workspace)
      setStudy(archive.study)
      setImportError('')
      replaceSurface({ kind: 'learning', location: archive.study.location })
    } catch {
      setImportError('这个文件不是有效的 AI 学习计划进度。当前数据没有被覆盖。')
    }
  }

  function resetProgress() {
    if (resetText !== 'RESET') return
    const reset = createDefaultStudyState()
    saveStudyState(reset)
    setStudy(reset)
    setResetText('')
    replaceSurface({ kind: 'learning', location: reset.location })
  }

  async function refreshArchiveRecords() {
    const records = await listArchiveRecords()
    setArchiveRecords(records)
    return records
  }

  async function handleArchiveImport(sourceId: string, file?: File) {
    if (!file) return
    setWorkspaceBusy(`archive:${sourceId}`)
    setArchiveError('')
    setArchiveMessage('')
    try {
      const target = archiveRecords.find((record) => record.id === sourceId)
      const result = await importArchivePdf(sourceId, file, target?.chapterId)
      const imported = result.document
      if (imported.chapterId === chapter.id) setDocuments((items) => [imported, ...items.filter((item) => item.id !== imported.id)])
      await refreshArchiveRecords()
      setArchiveMessage(result.migratedArtifacts
        ? `已保存并索引：${file.name}；迁移 ${result.migratedArtifacts} 条批注，其中 ${result.relocationRequired} 条待重新定位。`
        : `已保存并索引：${file.name}`)
      openLocalSource(imported)
    } catch (reason) {
      setArchiveError(reason instanceof Error ? reason.message : '资料导入失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  async function handleArchiveBatchImport(files: File[]) {
    if (!files.length) return
    setWorkspaceBusy('batch')
    setArchiveError('')
    setArchiveMessage('')
    let importedCount = 0
    const failures: string[] = []
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        failures.push(`${file.name}：不是 PDF`)
        continue
      }
      const matched = matchArchiveFile(file.name)
      if (!matched) {
        failures.push(`${file.name}：文件名无法唯一匹配清单`)
        continue
      }
      try {
        const { document: imported } = await importArchivePdf(matched.id, file, matched.chapterId)
        if (imported.chapterId === chapter.id) setDocuments((items) => [imported, ...items.filter((item) => item.id !== imported.id)])
        importedCount += 1
      } catch (reason) {
        failures.push(`${file.name}：${reason instanceof Error ? reason.message : '导入失败'}`)
      }
    }
    try {
      await refreshArchiveRecords()
      setArchiveMessage(`批量处理完成：成功 ${importedCount} 份${failures.length ? `，未完成 ${failures.length} 份` : ''}。`)
      if (failures.length) setArchiveError(failures.join('；'))
    } catch (reason) {
      setArchiveError(reason instanceof Error ? reason.message : '无法刷新归档清单。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  async function handleArchiveStatus(sourceId: string, status: ArchiveManualStatus) {
    setWorkspaceBusy(`status:${sourceId}`)
    setArchiveError('')
    try {
      setArchiveRecords(await updateArchiveStatus(sourceId, status))
      setArchiveMessage(status === 'needs-author-action' ? '已标记为需要作者开放导出或提供源文件。' : '已恢复为待检查。')
    } catch (reason) {
      setArchiveError(reason instanceof Error ? reason.message : '归档状态更新失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  async function handleDocumentDelete(document: WorkspaceDocument) {
    if (!window.confirm(`删除“${document.name}”？原文件会从应用资料目录移除；已有批注仍保留为待重新绑定记录。`)) return
    setWorkspaceBusy('delete')
    setWorkspaceError('')
    try {
      await deleteDocument(document.id)
      setDocuments((items) => items.filter((item) => item.id !== document.id))
      if (archiveOpen) await refreshArchiveRecords()
      if (sourceDocument?.id === document.id) goBack()
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : '文档删除失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  async function handleGenerateSummary(scope: 'stage' | 'chapter') {
    const targetKey = scope === 'stage' ? stageKey : chapter.id
    setWorkspaceBusy('summary')
    setWorkspaceError('')
    try {
      const chapterKeys = flattenChapter(chapter).map((item) => makeStageKey({ chapterId: chapter.id, stageId: item.id }))
      const relevant = scope === 'stage' ? [stageKey] : chapterKeys
      const context = relevant.map((key) => {
        const item = study.stageProgress[key]
        return `${key}\n笔记：${item?.note || '无'}\n测验：${item?.quizResult ? `${item.quizResult.score} 分，错题 ${item.quizResult.wrongQuestionIds.join('、') || '无'}` : '未完成'}`
      }).join('\n\n')
      await generateSummary({
        scope,
        targetKey,
        title: scope === 'stage' ? `${stage.title} · 本关小结` : `${chapter.title} · 学习档案`,
        context,
      })
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : '学习总结生成失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  function providerPayload(includeKey = true) {
    return providerKind === 'openai'
      ? { kind: 'openai' as const, ...(includeKey && apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }
      : {
          kind: 'relay' as const,
          ...(includeKey && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          profile: {
            kind: 'relay' as const,
            baseUrl: relayBaseUrl.trim(),
            textApi: relayTextApi,
            textModel: relayTextModel.trim(),
            embeddingMode: relayEmbeddingMode,
            ...(relayEmbeddingModel.trim() ? { embeddingModel: relayEmbeddingModel.trim() } : {}),
          },
        }
  }

  async function handleTestProvider() {
    setWorkspaceBusy('provider-test')
    setWorkspaceError('')
    setProviderTest(null)
    setProviderMessage('')
    try {
      setProviderTest(await testAiProvider(providerPayload()))
      setProviderMessage('能力测试完成；测试不会发送学习内容。')
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : 'AI 提供商测试失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  async function handleSaveProvider() {
    setWorkspaceBusy('provider-save')
    setWorkspaceError('')
    setProviderTest(null)
    setProviderMessage('')
    try {
      const saved = await saveAiProvider({ ...providerPayload(), activate: true })
      setApiKey('')
      setProviderTest(saved.result)
      setAiConfig(saved.config)
      setProviderMessage(saved.config.activeProvider === providerKind ? '配置已加密保存并设为当前提供商。' : '配置已加密保存，但文本能力不可用，未切换当前提供商。')
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : 'AI 提供商保存失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  async function handleDeleteRelay() {
    if (!window.confirm('删除中转站配置和对应的本机加密密钥？官方 OpenAI 配置不会受影响。')) return
    setWorkspaceBusy('provider-delete')
    setWorkspaceError('')
    try {
      const result = await deleteRelayProvider()
      setAiConfig(result.config)
      setProviderTest(null)
      setProviderMessage('中转站配置与对应密钥已删除。')
      setApiKey('')
      setRelayBaseUrl('')
      setRelayTextModel('')
      setRelayEmbeddingModel('')
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : '中转站配置删除失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  async function handleRebuildEmbeddings() {
    setWorkspaceBusy('embedding-rebuild')
    setWorkspaceError('')
    setProviderMessage('')
    try {
      const result = await rebuildChapterEmbeddings(chapter.id)
      setProviderMessage(result.indexedChunks ? `已为本章补建 ${result.indexedChunks} 段语义索引。` : '本章没有缺失的语义索引。')
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : '语义索引补建失败。')
    } finally {
      setWorkspaceBusy('')
    }
  }

  const mainSource = sourceHref(chapter)
  const selectedProvider = aiConfig?.providers[providerKind]
  const selectedResult = providerTest || selectedProvider?.status || null
  const hasSelectedKey = Boolean(selectedProvider?.hasApiKey || apiKey.trim())
  const relayFieldsReady = providerKind === 'openai' || Boolean(relayBaseUrl.trim() && relayTextModel.trim() && (relayEmbeddingMode !== 'enabled' || relayEmbeddingModel.trim()))
  const providerModels = [...new Set([...(providerTest?.models || []), ...(selectedProvider?.status?.models || [])])]
  const activeProviderLabel = aiConfig?.activeProvider === 'relay' ? '第三方中转站' : '官方 OpenAI'
  const selectedProviderLabel = providerKind === 'relay' ? '第三方中转站' : '官方 OpenAI'
  const activeProviderStatus = !aiConfig?.hasApiKey
    ? `当前启用：${activeProviderLabel} · 没有 API Key；地图、阅读、批注、测验和复习仍可离线使用。`
    : aiConfig.keyStatus === 'valid'
      ? `当前启用：${activeProviderLabel} · 可用 · ${aiConfig.answerModel}`
      : aiConfig.keyStatus === 'invalid'
        ? `当前启用：${activeProviderLabel} · API Key 无效，请检查对应提供商的密钥。`
        : aiConfig.keyStatus === 'restricted'
          ? `当前启用：${activeProviderLabel} · API Key 已保存，但当前模型或接口没有权限。`
          : `当前启用：${activeProviderLabel} · 密钥已加密保存，当前网络状态下暂未验证。`

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          ref={menuButton}
          className="icon-button topbar__rail-toggle"
          type="button"
          onClick={toggleCourseRail}
          aria-label={desktopRailOpen || mobileRailOpen ? '收起课程目录' : '打开课程目录'}
          aria-expanded={desktopRailOpen || mobileRailOpen}
          aria-controls="course-rail"
        >
          <Menu aria-hidden="true" />
        </button>
        <button className="topbar__identity" type="button" onClick={() => navigate(currentRef)} aria-label="返回学习台">
          <span>AI 学习手册</span><small>{releaseLabel(clientRelease)} · 数字实验笔记</small>
        </button>
        <div className="topbar__right">
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`切换到${theme === 'dark' ? '日间' : '夜间'}模式`} aria-pressed={theme === 'light'}>
            <span className="theme-toggle__icon" aria-hidden="true"><Sun className="theme-toggle__sun" /><Moon className="theme-toggle__moon" /></span>
            <span className="theme-toggle__label">{theme === 'dark' ? '夜间模式' : '日间模式'}</span>
            <span className="theme-toggle__track" aria-hidden="true"><span /></span>
          </button>
          <button
            ref={workspaceMenuButton}
            className="icon-button icon-button--quiet"
            type="button"
            onClick={() => setWorkspaceMenuOpen((current) => !current)}
            aria-label="打开工作区菜单"
            aria-expanded={workspaceMenuOpen}
            aria-controls="workspace-menu"
          >
            <LayoutGrid aria-hidden="true" />
          </button>
          <div ref={workspaceMenu} id="workspace-menu" className={`workspace-menu ${workspaceMenuOpen ? 'is-open' : ''}`} role="menu" aria-label="工作区">
            <button type="button" role="menuitem" onClick={() => { closeWorkspaceMenu(); navigate(currentRef) }}><BookOpen aria-hidden="true" /><span>学习台</span></button>
            <button ref={searchButton} type="button" role="menuitem" onClick={() => { closeWorkspaceMenu(); setSearchOpen(true) }}><Search aria-hidden="true" /><span>搜索课程</span><kbd>Ctrl K</kbd></button>
            <button type="button" role="menuitem" onClick={() => { closeWorkspaceMenu(); scrollToLessonSection('lesson-notes') }}><PenLine aria-hidden="true" /><span>笔记</span></button>
            <button type="button" role="menuitem" onClick={() => { closeWorkspaceMenu(); scrollToLessonSection('lesson-practice') }}><Target aria-hidden="true" /><span>练习</span></button>
            <button type="button" role="menuitem" onClick={(event) => { closeWorkspaceMenu(); openFavorites(event.currentTarget) }}><Star aria-hidden="true" /><span>收藏</span><small>{study.favoriteQuestions.length}</small></button>
            <button type="button" role="menuitem" onClick={(event) => { closeWorkspaceMenu(); openReview(dueItems, event.currentTarget) }}><RotateCcw aria-hidden="true" /><span>回顾</span><small>{dueItems.length}</small></button>
            <button type="button" role="menuitem" onClick={() => { closeWorkspaceMenu(); openArchive() }}><LibraryBig aria-hidden="true" /><span>资料归档</span></button>
            <button type="button" role="menuitem" onClick={() => { closeWorkspaceMenu(); openKnowledgeTree() }}><Network aria-hidden="true" /><span>知识树</span></button>
            <button ref={settingsButton} type="button" role="menuitem" onClick={(event) => { closeWorkspaceMenu(); openSettings(event.currentTarget) }}><Settings aria-hidden="true" /><span>设置</span></button>
          </div>
        </div>
      </header>

      <div className={`workspace ${desktopRailOpen ? 'is-rail-open' : 'is-rail-collapsed'} ${archiveOpen || favoritesOpen || knowledgeTreeOpen || study.location.kind === 'chapter-map' || sourceDocument ? 'is-wide-content' : ''} ${sourceDocument ? 'is-source-content' : ''}`}>
        <button
          className={`rail-backdrop ${mobileRailOpen ? 'is-open' : ''}`}
          type="button"
          aria-label="关闭课程目录"
          tabIndex={mobileRailOpen ? 0 : -1}
          onClick={closeMobileRail}
        />
        <aside id="course-rail" className={`course-rail ${desktopRailOpen ? 'is-desktop-open' : 'is-desktop-closed'} ${mobileRailOpen ? 'is-open' : ''}`} aria-label="课程目录">
          <div className="course-rail__brand">
            <div className="brand-mark" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
            </div>
            <strong>AI 学习计划</strong>
            <button
              className="icon-button icon-button--quiet mobile-only"
              type="button"
              onClick={closeMobileRail}
              aria-label="关闭课程目录"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <section className="course-rail__progress" aria-labelledby="course-progress-title">
            <div className="course-rail__progress-head">
              <span id="course-progress-title">整体进度</span>
              <strong>{overallProgress}%</strong>
            </div>
            <div
              className="course-rail__progress-track"
              role="progressbar"
              aria-label="课程整体进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={overallProgress}
              aria-valuetext={`已完成 ${masteredTotal} / ${courseTotal}`}
            >
              <span style={{ transform: `scaleX(${overallProgress / 100})` }} />
            </div>
            <p>已完成 {masteredTotal} / {courseTotal}</p>
          </section>

          <div className="course-nav__head">
            <span>课程目录</span>
          </div>
          <nav className="course-nav" aria-label="已注册章节">
            {getChapters().map((itemChapter, chapterIndex) => {
              const activeChapter = !archiveOpen && itemChapter.id === chapter.id
              const itemProgress = getChapterProgress(itemChapter.id, completedKeys)
              const complete = itemProgress.total > 0 && itemProgress.mastered === itemProgress.total
              return (
                <button
                  className={`course-nav__chapter-button ${activeChapter ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
                  type="button"
                  key={itemChapter.id}
                  onClick={() => { closeMobileRail(); openChapterMap(itemChapter.id) }}
                  aria-current={activeChapter ? 'page' : undefined}
                  aria-label={`${String(chapterIndex + 1).padStart(2, '0')} ${itemChapter.title} ${itemProgress.total ? Math.round((itemProgress.mastered / itemProgress.total) * 100) : 0}%，已完成 ${itemProgress.mastered} / ${itemProgress.total}`}
                >
                  <span className="course-nav__chapter-index">{String(chapterIndex + 1).padStart(2, '0')}</span>
                  <span className="course-nav__chapter-title">{itemChapter.shortTitle}</span>
                  <small>{itemProgress.mastered}/{itemProgress.total}</small>
                  {complete ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
                </button>
              )
            })}
          </nav>
          <div className="course-rail__foot">
            <span>学习记录</span>
            <div className="course-rail__week-total"><small>本周</small><strong>{weeklyFocusTime}</strong></div>
            <div className="week-chart" aria-label={`本周学习时长 ${weeklyFocusTime}`}>
              {weeklyMinutes.map((minutes, index) => (
                <div className={index === 5 ? 'is-today' : ''} key={index} title={`${['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index]} ${minutes} 分钟`}>
                  <span style={{ transform: `scaleY(${minutes / weeklyPeak})` }} />
                  <small>{['一', '二', '三', '四', '五', '六', '日'][index]}</small>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="lesson" id="main-content">
          <div className="lesson-context">
            <button className="lesson-context__back" type="button" onClick={goBack} aria-label="返回上一界面"><ArrowLeft aria-hidden="true" /></button>
            <span>{archiveOpen ? '资料归档' : favoritesOpen ? '收藏集' : knowledgeTreeOpen ? '知识树' : `${chapter.shortTitle} · ${study.location.kind === 'chapter-map' ? '知识地图' : `${String(stageNumber).padStart(2, '0')} ${stage.title}`}`}</span>
          </div>
          {!archiveOpen && !sourceDocument && <div className="mobile-focus">
            <FocusTimer
              compact
              minutes={study.timerMinutes}
              onMinutesChange={(timerMinutes) => setStudy((current) => ({ ...current, timerMinutes }))}
              onComplete={handleFocusComplete}
            />
          </div>}
          {sourceDocument ? (
            <SourceWorkspace
              chapter={archiveOpen ? { ...ARCHIVE_CONTEXT, id: sourceDocument.chapterId } : chapter}
              document={sourceDocument}
              stageRef={archiveOpen ? undefined : currentRef}
              stageTitle={archiveOpen ? undefined : stage.title}
              sourceRefs={archiveOpen ? undefined : stage.sourceRefs}
              stageNote={archiveOpen ? undefined : progressForStage?.note}
              onRequestKeyUpdate={() => openSettings(undefined, true)}
            />
          ) : archiveOpen ? (
            <ArchiveIndex
              records={archiveRecords}
              busy={workspaceBusy}
              message={archiveMessage}
              error={archiveError}
              onBatchImport={(files) => void handleArchiveBatchImport(files)}
              onImport={(sourceId, file) => void handleArchiveImport(sourceId, file)}
              onOpenDocument={(document) => openLocalSource(document)}
              onDeleteDocument={(document) => void handleDocumentDelete(document)}
              onSetStatus={(sourceId, status) => void handleArchiveStatus(sourceId, status)}
            />
          ) : favoritesOpen ? (
            <FavoritesPanel
              entries={favoriteEntries}
              onOpenStage={(favorite) => navigate(favorite.stage)}
              onRemove={removeFavorite}
            />
          ) : knowledgeTreeOpen ? (
            <Suspense fallback={<div className="knowledge-tree__loading">正在铺开知识树…</div>}>
              <KnowledgeTree
                chapters={getChapters()}
                progress={study.stageProgress}
                reviewQueue={study.reviewQueue}
                currentRef={currentRef}
                onOpenStage={navigate}
                onOpenChapter={openChapterMap}
                onOpenGlobal={openKnowledgeTree}
              />
            </Suspense>
          ) : reviewItems ? (
            <ReviewSession
              entries={reviewEntries}
              onAnswer={handleReviewAnswer}
              onClose={goBack}
              onOpenStage={(entry) => navigate(entry.item.stage)}
            />
          ) : study.location.kind === 'chapter-map' ? (
            <Suspense fallback={<div className="knowledge-tree__loading">正在铺开知识树…</div>}>
              <KnowledgeTree
              chapters={getChapters()}
              progress={study.stageProgress}
              reviewQueue={study.reviewQueue}
              expandedChapterId={chapter.id}
              currentRef={currentRef}
              onOpenStage={navigate}
              onOpenChapter={openChapterMap}
              onOpenGlobal={openKnowledgeTree}
              />
            </Suspense>
          ) : (
            <>
              {isPreviewingAhead && firstIncomplete && (
                <aside className="continuity-note">
                  <div>
                    <strong>你正在预览后续关卡。</strong>
                    <span>遇到卡点时，可以回到本章最早未通过的一关。</span>
                  </div>
                  <button type="button" onClick={() => navigate(firstIncomplete)}>回去补课</button>
                </aside>
              )}

              <article key={stageKey}>
                <header className="lesson-header">
                  <div className="lesson-header__meta">
                    <span>{unit.title}</span>
                    <span><Clock3 aria-hidden="true" /> {stage.durationMinutes} 分钟</span>
                    <span>{stage.sourceRefs.map((ref) => ref.label).join(' · ')}</span>
                  </div>
                  <p className="lesson-header__index">关卡 {String(stageNumber).padStart(2, '0')}</p>
                  <h1>{stage.title}</h1>
                  <p className="lesson-header__outcome">{stage.outcome}</p>
                </header>

                <section className="learning-brief" aria-label="关卡学习简报">
                  <section className="learning-goal" aria-labelledby="learning-goal-title">
                    <h2 id="learning-goal-title"><Target aria-hidden="true" />学习目标</h2>
                    <p>{stage.outcome}</p>
                    {stage.knowledge?.keyConcepts.length ? (
                      <ul aria-label="核心概念">
                        {stage.knowledge.keyConcepts.map((concept) => <li key={concept}>{concept}</li>)}
                      </ul>
                    ) : null}
                  </section>

                  <section className="problem" aria-labelledby="problem-title">
                    <h2 id="problem-title"><CircleHelp aria-hidden="true" />先判断</h2>
                    <p className="problem__scene">{stage.problem}</p>
                    <p className="problem__question">{stage.prediction.prompt}</p>
                    <div className="prediction-choices">
                      {stage.prediction.choices.map((choice) => (
                        <button
                          type="button"
                          className={`prediction-choice ${prediction === choice.id ? 'is-selected' : ''}`}
                          key={`${stageKey}:${choice.id}`}
                          onClick={() => setPredictions((current) => ({ ...current, [stageKey]: choice.id }))}
                          aria-pressed={prediction === choice.id}
                        >
                          <span className="prediction-choice__key">{choice.id.toUpperCase()}</span>
                          <span className="prediction-choice__label">{choice.label}</span>
                        </button>
                      ))}
                    </div>
                    {prediction && (
                      <div className={`prediction-feedback ${prediction === stage.prediction.answer ? 'is-correct' : 'is-wrong'}`} role="status">
                        {prediction === stage.prediction.answer ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                        <p><strong>{prediction === stage.prediction.answer ? '判断对了。' : '先保留这个判断。'}</strong> {stage.prediction.feedback}</p>
                      </div>
                    )}
                  </section>
                </section>

                {stage.formula && <blockquote className="formula">{stage.formula}</blockquote>}

                <div className="lesson-blocks">
                  <span
                    className="lesson-blocks__progress"
                    style={{ transform: `scaleY(${stage.lesson.length <= 1 ? 1 : activeLessonIndex / (stage.lesson.length - 1)})` }}
                    aria-hidden="true"
                  />
                  {stage.lesson.map((block, index) => (
                    <section
                      className={`lesson-block ${index === activeLessonIndex ? 'is-active' : ''} ${index < activeLessonIndex ? 'is-read' : ''}`}
                      id={`lesson-section-${index}`}
                      data-lesson-section={index}
                      tabIndex={-1}
                      key={block.title}
                    >
                      <button className="lesson-block__number" type="button" onClick={() => scrollToLessonBlock(index)} aria-label={`前往 ${stageNumber}.${index + 1}，预计 ${sectionMinutes[index]} 分钟`}>
                        <span>{stageNumber}.{index + 1}</span><small>~{sectionMinutes[index]} min</small>
                      </button>
                      <div>
                        <h2><span>{stageNumber}.{index + 1}</span>{block.title}</h2>
                        {block.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                        {block.points && <ul>{block.points.map((point) => <li key={point}>{point}</li>)}</ul>}
                      </div>
                    </section>
                  ))}
                </div>

                {stage.codeLens && (
                  <section className="code-lens" aria-labelledby="code-lens-title">
                    <div className="section-heading">
                      <h2 id="code-lens-title">{stage.codeLens.title}</h2>
                      <span>只看关键结构</span>
                    </div>
                    <pre><code>{stage.codeLens.code}</code></pre>
                    <ul>{stage.codeLens.watch.map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                )}

                <div id="lesson-practice" className="lesson-anchor" tabIndex={-1}>
                {isConceptCheckPractice(stage.practice) ? (
                  <ConceptCheck practice={stage.practice} />
                ) : isProjectStepPractice(stage.practice) ? (
                  <ProjectStep
                    practice={stage.practice}
                    submission={study.practiceSubmissions[practiceKey]}
                    onDraft={(answers) => savePracticeDraft(practiceKey, answers)}
                  />
                ) : currentSubmitPractice ? (
                  <PracticeWorkbench
                    practice={currentSubmitPractice}
                    submission={study.practiceSubmissions[practiceKey]}
                    hasApiKey={Boolean(aiConfig?.hasApiKey)}
                    busy={workspaceBusy === 'practice-feedback'}
                    onDraft={(answers) => savePracticeDraft(practiceKey, answers)}
                    onToggleRubric={(id) => togglePracticeRubric(practiceKey, id)}
                    onSubmit={() => submitPractice(practiceKey, currentSubmitPractice)}
                    onFeedback={() => void requestPracticeFeedback(currentSubmitPractice, practiceKey)}
                    onOpenSettings={() => settingsDialog.current?.showModal()}
                  />
                ) : (
                  <section className="practice" aria-labelledby="practice-title">
                    <div className="section-heading"><h2 id="practice-title">{stage.practice.title}</h2><span>现在动手</span></div>
                    <p>{stage.practice.brief}</p>
                    <div className="practice__success"><Check aria-hidden="true" /><span><strong>完成标准</strong>{stage.practice.success}</span></div>
                  </section>
                )}
                </div>

                {stage.codexTask && (
                  <section className="codex-task" aria-labelledby="codex-task-title">
                    <div className="section-heading">
                      <h2 id="codex-task-title">交给 Codex</h2>
                      <span>工程任务卡</span>
                    </div>
                    <h3>{stage.codexTask.title}</h3>
                    <p>{stage.codexTask.goal}</p>
                    <dl>
                      <div><dt>范围</dt><dd>{stage.codexTask.scope.join(' · ')}</dd></div>
                      <div><dt>验收</dt><dd>{stage.codexTask.acceptance.join(' · ')}</dd></div>
                    </dl>
                    <button className="button button--secondary" type="button" onClick={copyTask} data-state={copied ? 'copied' : undefined}>
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      {copied ? '已复制任务卡' : '复制任务卡'}
                    </button>
                  </section>
                )}

                <section className="source-entry" aria-labelledby="source-entry-title">
                  <FileText aria-hidden="true" />
                  <div>
                    <h2 id="source-entry-title">回到手册原文</h2>
                    <p>{stage.sourceRefs.map((ref) => ref.label).join(' · ')}</p>
                  </div>
                  <button className="text-link" type="button" onClick={(event) => stageSourceDocument
                    ? openLocalSource(stageSourceDocument, event.currentTarget)
                    : openRemoteSource(event.currentTarget)}>
                    阅读原文 <ArrowRight aria-hidden="true" />
                  </button>
                </section>

                <section className="notes" aria-labelledby="notes-title">
                  <div className="section-heading">
                    <h2 id="notes-title">我的一句话</h2>
                    <span className={`note-save-status is-${noteSaveStatus}`} role="status">{noteSaveStatus === 'saving' ? '保存中…' : '已保存到本机'}</span>
                  </div>
                  <label htmlFor="stage-note">用自己的话写下本关最重要的判断</label>
                  <textarea
                    id="stage-note"
                    value={progressForStage?.note ?? ''}
                    placeholder="例如：实时事实不该让模型猜，要用工具查。"
                    onChange={(event) => {
                      const note = event.target.value
                      markNoteSaving()
                      setStudy((current) => ({
                        ...current,
                        stageProgress: {
                          ...current.stageProgress,
                          [stageKey]: { ...current.stageProgress[stageKey], note },
                        },
                      }))
                    }}
                  />
                </section>

                <QuizPanel
                  stage={stage}
                  stageRef={currentRef}
                  previous={progressForStage?.quizResult}
                  onResult={handleQuizResult}
                  favoriteQuestionIds={currentFavoriteQuestionIds}
                  onToggleFavorite={toggleFavorite}
                />

                {progressForStage?.completedAt && (
                  <section className="stage-summary-callout" aria-label="本关学习小结">
                    <div><strong>把这一关收进学习档案</strong><span>根据本关笔记、测验与原文证据生成，只有点击后才会调用模型。</span></div>
                    <button className="button button--secondary" type="button" onClick={() => void handleGenerateSummary('stage')} disabled={workspaceBusy === 'summary'}>
                      {workspaceBusy === 'summary' ? '正在生成…' : '生成本关小结'}
                    </button>
                  </section>
                )}

                <section className="bridge" aria-label="下一关线索">
                  <p>{stage.bridge}</p>
                  <div className="bridge__actions">
                    <button className="text-link" type="button" onClick={() => previousRef && navigate(previousRef)} disabled={!previousRef}>
                      <ArrowLeft aria-hidden="true" /> 上一关
                    </button>
                    {isLastInChapter && dueItems.length > 0 ? (
                      <button className="button button--primary" type="button" onClick={(event) => openReview(dueItems, event.currentTarget)}>
                        开始到期复习 <ArrowRight aria-hidden="true" />
                      </button>
                    ) : nextRef ? (
                      <button className="button button--primary" type="button" onClick={() => navigate(nextRef)}>
                        {nextRef.chapterId === chapter.id ? '下一关' : `进入 ${getChapter(nextRef.chapterId)?.title ?? '下一章'}`}
                        <ArrowRight aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="bridge__complete">{chapterProgress.mastered === chapterProgress.total ? '本章已全部掌握' : '完成测验后，本章就收尾了'}</span>
                    )}
                  </div>
                </section>

                <footer className="inline-footer">
                  <span>{chapter.title} · {chapterProgress.total} 关</span>
                  <span>已掌握 {masteredTotal} 关</span>
                  <button type="button" onClick={(event) => openSettings(event.currentTarget)}>导出进度</button>
                </footer>
              </article>
            </>
          )}
        </main>

        {!archiveOpen && study.location.kind === 'stage' && !sourceDocument && <aside className="study-aside" aria-label="学习工具">
          <FocusTimer
            minutes={study.timerMinutes}
            onMinutesChange={(timerMinutes) => setStudy((current) => ({ ...current, timerMinutes }))}
            onComplete={handleFocusComplete}
          />
          <section className="today-path">
            <div className="today-path__head"><span>接下来</span></div>
            <ol>
              {nextTasks.map((task, index) => (
                <li key={task.key} className={task.done ? 'is-done' : ''}>
                  <button type="button" onClick={task.action}>
                    <span>{task.done ? <Check aria-hidden="true" /> : index + 1}</span>
                    <span><strong>{task.label}</strong><small>{task.meta}</small></span>
                  </button>
                </li>
              ))}
            </ol>
            {nextTasks.length === 0 && <p className="today-path__empty">本章任务已完成</p>}
          </section>
          {nextRef && (
            <button className="aside-next" type="button" onClick={() => navigate(nextRef)}>
              <Flag aria-hidden="true" />
              <span><strong>下一关</strong><small>{getStage(nextRef)?.title}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          )}
          {mainSource && (
            <a className="aside-source" href={mainSource} target="_blank" rel="noreferrer">
              打开本章原文 <ExternalLink aria-hidden="true" />
            </a>
          )}
        </aside>}
      </div>

      <SourceDialog ref={sourceDialog} chapter={chapter} sourceRefs={stage.sourceRefs} onRequestClose={goBack} />
      <CourseSearchDialog
        items={courseSearchItems}
        open={searchOpen}
        onClose={() => { setSearchOpen(false); window.setTimeout(() => searchButton.current?.focus(), 0) }}
        onSelect={navigate}
      />

      <dialog
        className="settings-dialog"
        ref={settingsDialog}
        aria-labelledby="settings-title"
        onCancel={(event) => { event.preventDefault(); goBack() }}
        onClick={(event) => { if (event.target === event.currentTarget) goBack() }}
      >
        <header className="dialog__header">
          <button className="dialog__back" type="button" onClick={goBack} aria-label="返回上一界面"><ArrowLeft aria-hidden="true" /><span>返回</span></button>
          <div><p>本地数据</p><h2 id="settings-title">进度管理</h2></div>
        </header>
        <div className="settings-dialog__body">
          <section className="release-settings" aria-labelledby="release-settings-title">
            <div className="release-settings__head">
              <div><p>应用发布版本</p><h3 id="release-settings-title">{releaseLabel(clientRelease)}</h3></div>
              <span className={releaseStatus?.compatible ? 'is-current' : 'is-warning'}>{releaseStatus?.compatible ? '前后端一致' : releaseStatus ? '版本不一致' : '服务未连接'}</span>
            </div>
            <dl>
              <div><dt>通道</dt><dd>{clientRelease.channel}</dd></div>
              <div><dt>发布日期</dt><dd>{clientRelease.releasedAt}</dd></div>
              <div><dt>构建</dt><dd title={clientRelease.buildId}>{clientRelease.buildId}</dd></div>
              <div><dt>备份格式</dt><dd>v{ARCHIVE_VERSION}</dd></div>
              <div><dt>本地学习状态</dt><dd>v{STUDY_STATE_VERSION}</dd></div>
            </dl>
            <details className="release-history" open>
              <summary>历代版本更新</summary>
              <ol className="release-history__list">
                {clientRelease.history.map((entry, index) => (
                  <li className="release-history__entry" key={entry.version}>
                    <header>
                      <strong>{releaseLabel({ version: entry.version, channel: 'stable' })}</strong>
                      <time dateTime={entry.releasedAt}>{entry.releasedAt}</time>
                      {index === 0 && <span>当前版本</span>}
                    </header>
                    <ul>{entry.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
                  </li>
                ))}
              </ol>
            </details>
          </section>
          <section>
            <h3>备份</h3>
            <p>导出备份格式 v{ARCHIVE_VERSION}，当前包含本地学习状态 v{STUDY_STATE_VERSION}：关卡、测验、笔记、复习、收藏、实践提交、批注、追问与总结；不含 API Key、原文、提取文本或嵌入。</p>
            <p className="settings-status">“我的一句话”、测验、收藏、实践提交与学习进度保存在应用专用 Edge 配置 <code>%LOCALAPPDATA%\AIStudyPlan\EdgeProfileV2\Default\Local Storage\leveldb</code> 的本地存储键 <code>{STORAGE_KEY}</code>；旧版 v1–v4 键只作为兼容迁移来源保留。最近使用的重点与批注颜色保存在 <code>ai-study:artifact-colors:v1</code>，待同步批注草稿保存在 <code>ai-study:annotation-drafts:v1</code>；原文重点和已保存批注保存在 <code>%LOCALAPPDATA%\AIStudyPlan\data\workspace.sqlite</code>。请使用导出功能备份，不要直接编辑这些文件。</p>
            <div className="button-row">
              <button className="button button--secondary" type="button" onClick={() => void exportProgress()}><Download aria-hidden="true" /> 导出学习档案</button>
              <label className="button button--secondary file-button"><Upload aria-hidden="true" /> 导入进度<input type="file" accept="application/json,.json" onChange={(event) => importProgress(event.target.files?.[0])} /></label>
            </div>
            <p className="form-error" role={importError ? 'alert' : undefined}>{importError}</p>
          </section>
          <section className="ai-settings">
            <div className="ai-settings__heading">
              <div><p>本地 AI 接入</p><h3>原文追问与实践点评</h3></div>
              <span>{aiConfig?.activeProvider === 'relay' ? '中转站' : 'OpenAI'}</span>
            </div>
            <fieldset className="provider-switch">
              <legend>选择要配置的提供商</legend>
              <label className={providerKind === 'openai' ? 'is-selected' : ''}>
                <input type="radio" name="ai-provider" value="openai" checked={providerKind === 'openai'} onChange={() => { setProviderKind('openai'); setProviderTest(null); setProviderMessage('') }} />
                <strong>官方 OpenAI</strong><span>使用官方地址与现有模型</span>
              </label>
              <label className={providerKind === 'relay' ? 'is-selected' : ''}>
                <input type="radio" name="ai-provider" value="relay" checked={providerKind === 'relay'} onChange={() => { setProviderKind('relay'); setProviderTest(null); setProviderMessage('') }} />
                <strong>第三方中转站</strong><span>自动检测兼容接口</span>
              </label>
            </fieldset>

            {providerKind === 'relay' && <div className="provider-fields">
              <label htmlFor="relay-base-url">Base URL</label>
              <input id="relay-base-url" type="url" inputMode="url" autoComplete="url" value={relayBaseUrl} onChange={(event) => setRelayBaseUrl(event.target.value)} placeholder="https://example.com/v1" />
              <p className="field-help">公网只接受 HTTPS；若没有 <code>/v1</code>，应用会安全探测并保存成功地址。</p>
              <div className="provider-fields__grid">
                <div>
                  <label htmlFor="relay-text-api">文本接口</label>
                  <select id="relay-text-api" value={relayTextApi} onChange={(event) => setRelayTextApi(event.target.value as AiTextApi)}>
                    <option value="auto">自动检测</option>
                    <option value="responses">Responses</option>
                    <option value="chat-completions">Chat Completions</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="relay-text-model">文本模型</label>
                  <input id="relay-text-model" list="provider-models" value={relayTextModel} onChange={(event) => setRelayTextModel(event.target.value)} placeholder="由中转站提供" />
                </div>
                <div>
                  <label htmlFor="relay-embedding-mode">向量检索</label>
                  <select id="relay-embedding-mode" value={relayEmbeddingMode} onChange={(event) => setRelayEmbeddingMode(event.target.value as AiEmbeddingMode)}>
                    <option value="auto">自动检测</option>
                    <option value="enabled">启用</option>
                    <option value="disabled">关闭，仅关键词检索</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="relay-embedding-model">嵌入模型</label>
                  <input id="relay-embedding-model" list="provider-models" value={relayEmbeddingModel} onChange={(event) => setRelayEmbeddingModel(event.target.value)} placeholder={relayEmbeddingMode === 'enabled' ? '必填' : '可留空'} disabled={relayEmbeddingMode === 'disabled'} />
                </div>
              </div>
              <datalist id="provider-models">{providerModels.map((model) => <option value={model} key={model} />)}</datalist>
            </div>}

            {providerKind === 'openai' && <dl className="provider-fixed-models">
              <div><dt>文本模型</dt><dd>{aiConfig?.providers.openai.profile?.textModel || 'gpt-5.6-terra'}</dd></div>
              <div><dt>嵌入模型</dt><dd>{aiConfig?.providers.openai.profile?.embeddingModel || 'text-embedding-3-small'}</dd></div>
            </dl>}

            <label htmlFor="openai-api-key">{providerKind === 'relay' ? '中转站 API Key' : 'OpenAI API Key'}</label>
            <input ref={apiKeyInput} id="openai-api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={selectedProvider?.hasApiKey ? '已加密保存；留空则继续使用' : '输入新的 API Key'} />
            <p className="field-help">Key 只传给本机服务并使用 Windows DPAPI 加密，不要求必须以 <code>sk-</code> 开头。</p>

            <div className="provider-actions">
              <button className="button button--secondary" type="button" onClick={() => void handleTestProvider()} disabled={!hasSelectedKey || !relayFieldsReady || workspaceBusy === 'provider-test'}>{workspaceBusy === 'provider-test' ? '检测中…' : '测试能力'}</button>
              <button className="button" type="button" onClick={() => void handleSaveProvider()} disabled={!hasSelectedKey || !relayFieldsReady || workspaceBusy === 'provider-save'}>{workspaceBusy === 'provider-save' ? '保存中…' : '加密保存并启用'}</button>
              {providerKind === 'relay' && aiConfig?.providers.relay.profile && <button className="button button--quiet" type="button" onClick={() => void handleDeleteRelay()} disabled={workspaceBusy === 'provider-delete'}>删除中转配置</button>}
            </div>

            <p className="settings-status">{workspaceBusy === 'provider-test' ? `正在测试：${selectedProviderLabel}` : `正在配置：${selectedProviderLabel}`}</p>

            {selectedResult && <div className="provider-result" aria-live="polite">
              <strong>{providerTest ? '本次测试' : '已保存状态'} · {selectedResult.keyStatus === 'valid' ? '连接可用' : selectedResult.keyStatus === 'invalid' ? '鉴权失败' : selectedResult.keyStatus === 'restricted' ? '权限不足' : '暂未验证'}</strong>
              <dl>
                <div><dt>文本</dt><dd>{selectedResult.capabilities.text === 'responses' ? 'Responses' : selectedResult.capabilities.text === 'chat-completions' ? 'Chat Completions' : '不可用'}</dd></div>
                <div><dt>向量</dt><dd>{selectedResult.capabilities.embeddings === 'available' ? '可用' : selectedResult.capabilities.embeddings === 'unavailable' ? '不可用，使用关键词检索' : '未检测'}</dd></div>
                <div><dt>地址</dt><dd>{selectedResult.resolvedBaseUrl || selectedProvider?.profile?.baseUrl || '官方地址'}</dd></div>
                {selectedResult.networkResolution === 'proxy-fake-ip' && <div><dt>网络</dt><dd>代理 fake-IP 已安全复核</dd></div>}
              </dl>
              {selectedResult.error && <p>{selectedResult.error}</p>}
            </div>}

            {aiConfig?.activeProvider === providerKind && aiConfig.capabilities.embeddings === 'available' && <button className="button button--secondary embedding-rebuild" type="button" onClick={() => void handleRebuildEmbeddings()} disabled={workspaceBusy === 'embedding-rebuild'}>{workspaceBusy === 'embedding-rebuild' ? '正在补建…' : `为《${chapter.title}》补建语义索引`}</button>}

            <p className="provider-privacy">{providerKind === 'relay'
              ? '使用中转站时，问题、实践答案以及命中的原文片段会发送给该中转站；数据保留与隐私规则由中转站决定。'
              : '命中的原文片段会发送给 OpenAI。store: false 不等于完全不留存，请按官方数据政策判断敏感内容。'}</p>
            <p className="settings-status">{activeProviderStatus}</p>
            {providerMessage && <p className="form-success" role="status">{providerMessage}</p>}
            {workspaceError && <p className="form-error" role="alert">{workspaceError}</p>}
          </section>
          <section className="danger-zone">
            <h3>重置</h3>
            <label htmlFor="reset-confirm">输入 RESET 清除 v4 学习记录；旧版迁移备份会保留。</label>
            <div className="input-row">
              <input id="reset-confirm" value={resetText} onChange={(event) => setResetText(event.target.value)} />
              <button className="button button--danger" type="button" onClick={resetProgress} disabled={resetText !== 'RESET'}>清除记录</button>
            </div>
          </section>
        </div>
      </dialog>
    </div>
  )
}

export default App
