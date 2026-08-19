export type Choice = {
  id: string
  label: string
}

export type Prediction = {
  prompt: string
  choices: Choice[]
  answer: string
  feedback: string
}

export type LessonBlock = {
  title: string
  paragraphs: string[]
  points?: string[]
}

export type QuizQuestion = {
  id: string
  prompt: string
  choices: Choice[]
  answer: string
  explanation: string
  scenario: boolean
  critical?: boolean
}

export type CodexTask = {
  title: string
  context: string
  goal: string
  scope: string[]
  constraints: string[]
  acceptance: string[]
  tests: string[]
}

export type LegacyStage = {
  id: number
  act: number
  title: string
  duration: number
  sourceRange: string
  problem: string
  outcome: string
  prediction: Prediction
  formula: string
  lesson: LessonBlock[]
  codeLens?: CodeLens
  practice: Practice
  codexTask?: CodexTask
  bridge: string
  quiz: QuizQuestion[]
}

export type CodeLens = {
  title: string
  code: string
  watch: string[]
}

export type Practice = {
  title: string
  brief: string
  success: string
}

export type PracticeFrame = Practice & {
  estimatedMinutes: number
  context: string
  given: string[]
  deliverable: string
  constraints: string[]
}

export type ConceptCheckPractice = PracticeFrame & {
  mode: 'concept-check'
  prompt: string
  choices: Choice[]
  answer: string
  feedback: string
}

export type ProjectPracticeField = {
  id: string
  label: string
  prompt: string
  placeholder: string
  artifact: string
  format: 'markdown' | 'json' | 'test-output'
}

export type ProjectPracticeRubric = {
  id: string
  label: string
  criterion: string
  evidencePrompt: string
  critical?: boolean
}

export type JsonObjectPracticeCheck = {
  id: string
  label: string
  fieldId: string
  kind: 'json-object'
  requiredPaths: string[]
}

export type JsonArrayPracticeCheck = {
  id: string
  label: string
  fieldId: string
  kind: 'json-array'
  minItems: number
  itemRequiredPaths: string[]
  requiredValues?: { path: string; values: string[] }
}

export type TestOutputPracticeCheck = {
  id: string
  label: string
  fieldId: string
  kind: 'test-output'
  requiredPhrases: string[]
}

export type PracticeAutoCheck = JsonObjectPracticeCheck | JsonArrayPracticeCheck | TestOutputPracticeCheck

export type ProjectStepPractice = PracticeFrame & {
  mode: 'project-step'
  milestoneStageId: StageId
  milestoneTitle: string
  starterPackUrl: string
  fields: ProjectPracticeField[]
}

export type ProjectSubmitPractice = PracticeFrame & {
  mode: 'project-submit'
  milestoneId: string
  starterPackUrl: string
  artifactFiles: string[]
  validationCommands: string[]
  fields: ProjectPracticeField[]
  rubric: ProjectPracticeRubric[]
  autoChecks: PracticeAutoCheck[]
  hints: [string, string]
  reference: { outline: string[]; exampleAnswers: Record<string, string>; commonMistakes: string[] }
}

export type PracticeActivity = Practice | ConceptCheckPractice | ProjectStepPractice | ProjectSubmitPractice
export type PracticeFeedback = {
  strengths: string[]
  gaps: string[]
  rubric: Array<{ id: string; status: 'met' | 'partial' | 'missing'; note: string }>
  nextStep: string
  inputTokens: number
  outputTokens: number
  createdAt: string
}
export type PracticeSubmission = {
  answers: Record<string, string>
  checkedRubricIds: string[]
  draftUpdatedAt: string
  submittedAt?: string
  revisionCount: number
  feedback?: PracticeFeedback
}

export type ChapterId = string
export type UnitId = string
export type StageId = string
export type StageKey = `${string}:${string}`

export type StageRef = {
  chapterId: ChapterId
  stageId: StageId
}

export type KnowledgeDepth =
  | 'recognize'
  | 'understand'
  | 'apply'
  | 'transfer'
  | 'master'

export type StageKnowledge = {
  depth: KnowledgeDepth
  keyConcepts: string[]
  prerequisites: StageRef[]
}

export type KnowledgeNodeId = `chapter:${ChapterId}` | `stage:${StageKey}`

export type KnowledgeNodeState = {
  progress: 'not-started' | 'learning' | 'mastered'
  weak: boolean
  due: boolean
  justUnlocked: boolean
}

export type KnowledgeNode = {
  id: KnowledgeNodeId
  kind: 'chapter' | 'stage'
  ref?: StageRef
  chapterId: ChapterId
  unitId?: UnitId
  title: string
  objective: string
  evidence: string
  minutes: number
  knowledge?: StageKnowledge
  state: KnowledgeNodeState
}

export type KnowledgeEdge = {
  id: string
  from: KnowledgeNodeId
  to: KnowledgeNodeId
  kind: 'prerequisite'
}

export type RemoteSource = {
  id: string
  kind: 'remote'
  title: string
  provider: 'feishu' | 'web'
  url: string
  embed: 'attempt' | 'external-only'
}

export type BundledSource = {
  id: string
  kind: 'bundled'
  title: string
  format: 'pdf' | 'html' | 'markdown'
  assetUrl: string
}

export type SourceDefinition = RemoteSource | BundledSource

export type SourceReference = {
  sourceId: string
  label: string
  deepLink?: string
}

export type ChapterUnit = {
  id: UnitId
  title: string
  stageIds: StageId[]
}

export type Stage = {
  id: StageId
  unitId: UnitId
  title: string
  durationMinutes: number
  sourceRefs: SourceReference[]
  problem: string
  outcome: string
  prediction: Prediction
  formula?: string
  lesson: LessonBlock[]
  codeLens?: CodeLens
  practice: PracticeActivity
  codexTask?: CodexTask
  bridge: string
  quiz: QuizQuestion[]
  knowledge?: StageKnowledge
}

export type ChapterPackage = {
  contentSchemaVersion: 1 | 2
  id: ChapterId
  title: string
  shortTitle: string
  order: number
  prerequisites?: ChapterId[]
  sources: SourceDefinition[]
  units: ChapterUnit[]
  stages: Stage[]
}

export type QuizResult = {
  score: number
  passed: boolean
  answeredAt: string
  wrongQuestionIds: string[]
  attempt: number
}

export type StageProgress = {
  completedAt?: string
  quizResult?: QuizResult
  note?: string
  weak?: boolean
  firstOpenedAt?: string
  lastOpenedAt?: string
}

export type ReviewItem = {
  stage: StageRef
  dueAt: string
  intervalIndex: number
}

export type FocusSession = {
  stage: StageRef
  completedAt: string
  minutes: number
}

export type StudyStateV2 = {
  version: 2
  current: StageRef
  lastStageByChapter: Record<ChapterId, StageId>
  stageProgress: Record<StageKey, StageProgress>
  reviewQueue: ReviewItem[]
  timerMinutes: number
  focusSessions: FocusSession[]
}

export type LearningLocation =
  | { kind: 'chapter-map'; chapterId: ChapterId }
  | { kind: 'stage'; ref: StageRef }

export type StudyStateV3 = {
  version: 3
  location: LearningLocation
  lastStageByChapter: Record<ChapterId, StageId>
  chapterOverviewSeen: Record<ChapterId, boolean>
  stageProgress: Record<StageKey, StageProgress>
  reviewQueue: ReviewItem[]
  timerMinutes: number
  focusSessions: FocusSession[]
}

export type FavoriteQuestionRef = {
  stage: StageRef
  questionId: string
  savedAt: string
}

export type StudyStateV4 = Omit<StudyStateV3, 'version'> & {
  version: 4
  favoriteQuestions: FavoriteQuestionRef[]
}
export type StudyStateV5 = Omit<StudyStateV4, 'version'> & {
  version: 5
  practiceSubmissions: Record<StageKey, PracticeSubmission>
}

export type DocumentKind = 'pdf' | 'markdown' | 'html'

export type WorkspaceDocument = {
  id: string
  chapterId: ChapterId
  sourceId: string
  name: string
  kind: DocumentKind
  size: number
  checksum: string
  pageCount: number
  chunkCount: number
  indexed: boolean
  importedAt: string
  versionNumber: number
  isLatest: boolean
}

export type DocumentImportResult = {
  document: WorkspaceDocument
  migratedArtifacts: number
  relocationRequired: number
}

export type ArchiveCatalogEntry = {
  id: string
  order: number
  title: string
  url: string
  aliases: string[]
  courseReady: boolean
  chapterId?: ChapterId
}

export type ArchiveManualStatus = 'pending' | 'needs-author-action' | 'failed'
export type ArchiveDerivedStatus = ArchiveManualStatus | 'archived' | 'indexed'

export type ArchiveRecord = ArchiveCatalogEntry & {
  status: ArchiveDerivedStatus
  note: string
  updatedAt?: string
  documents: WorkspaceDocument[]
}

export type TextAnchor =
  | {
    kind: 'lesson'
    stageKey: StageKey
    blockId: string
    start: number
    end: number
    quote: string
  }
  | {
    kind: 'document'
    documentId: string
    page?: number
    blockId: string
    start: number
    end: number
    quote: string
  }

export type ArtifactColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export type LearningArtifact = {
  id: string
  chapterId: ChapterId
  stageKey?: StageKey
  type: 'highlight' | 'annotation'
  color?: ArtifactColor
  anchor: TextAnchor
  note?: string
  needsRelocation?: boolean
  createdAt: string
  updatedAt: string
}

export type EvidenceCitation = {
  documentId: string
  chunkId: string
  title: string
  page?: number
  section?: string
  quote: string
}

export type AiAnswer = {
  id: string
  chapterId: ChapterId
  stageKey?: StageKey
  question: string
  answer: string
  confidence: 'low' | 'medium' | 'high'
  citations: EvidenceCitation[]
  followUps: string[]
  inputTokens: number
  outputTokens: number
  createdAt: string
}

export type LearningSummary = {
  id: string
  scope: 'stage' | 'chapter'
  targetKey: string
  title: string
  body: string
  citations: EvidenceCitation[]
  inputTokens: number
  outputTokens: number
  generatedAt: string
}

export type LegacyQuizResult = QuizResult

export type StudyStateV1 = {
  version: 1
  currentStageId: number
  completedStageIds: number[]
  quizResults: Record<number, LegacyQuizResult>
  notes: Record<number, string>
  reviewQueue: Array<{ stageId: number; dueAt: string; intervalIndex: number }>
  timerMinutes: number
  focusSessions: Array<{ stageId: number; completedAt: string; minutes: number }>
}
