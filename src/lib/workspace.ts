import type {
  AiAnswer,
  ArchiveManualStatus,
  ArchiveRecord,
  DocumentImportResult,
  LearningArtifact,
  LearningSummary,
  PracticeFeedback,
  WorkspaceDocument,
} from '../types'
import type { ClientRelease } from '../release'

type ApiErrorBody = { error?: string; code?: string }

export class WorkspaceApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'WorkspaceApiError'
    this.code = code
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof ArrayBuffer || init?.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let body: ApiErrorBody = {}
    try { body = await response.json() as ApiErrorBody } catch { /* use status text */ }
    throw new WorkspaceApiError(body.error || `本地服务请求失败（${response.status}）`, body.code)
  }
  return response.json() as Promise<T>
}

export type AiProviderKind = 'openai' | 'relay'
export type AiTextApi = 'auto' | 'responses' | 'chat-completions'
export type AiEmbeddingMode = 'auto' | 'enabled' | 'disabled'

export type AiProviderProfile = {
  kind: AiProviderKind
  baseUrl: string
  textApi: AiTextApi
  textModel: string
  embeddingMode: AiEmbeddingMode
  embeddingModel?: string
}

export type ProviderCapabilities = {
  authentication: 'valid' | 'invalid' | 'unverified'
  text: 'responses' | 'chat-completions' | 'unavailable'
  embeddings: 'available' | 'unavailable' | 'not-tested'
}

export type ProviderTestResult = {
  keyStatus: 'missing' | 'unverified' | 'valid' | 'invalid' | 'restricted'
  validatedAt?: string
  resolvedBaseUrl?: string
  networkResolution?: 'system-dns' | 'proxy-fake-ip'
  models: string[]
  capabilities: ProviderCapabilities
  canActivate: boolean
  error?: string
  code?: string
}

type ProviderStatus = {
  kind: AiProviderKind
  hasApiKey: boolean
  status: ProviderTestResult | null
  profile: AiProviderProfile | null
}

export type AiConfigStatus = {
  activeProvider: AiProviderKind
  hasApiKey: boolean
  keyStatus: 'missing' | 'unverified' | 'valid' | 'invalid' | 'restricted'
  validatedAt?: string
  answerModel: string
  embeddingModel: string
  capabilities: ProviderCapabilities
  providers: { openai: ProviderStatus; relay: ProviderStatus }
}

export type SaveProviderInput = {
  kind: AiProviderKind
  apiKey?: string
  activate?: boolean
  profile?: Omit<AiProviderProfile, 'kind'> & { kind?: 'relay' }
}

export type ReleaseStatus = ClientRelease & {
  appVersion: string
  buildVersion: string | null
  compatible: boolean
}

export async function getReleaseStatus() {
  return api<ReleaseStatus>('/api/version')
}

export async function getAiConfig() {
  return api<AiConfigStatus>('/api/config/status')
}

export async function saveApiKey(apiKey: string) {
  return api<{ ok: true; keyStatus: AiConfigStatus['keyStatus']; validatedAt?: string }>('/api/config/key', { method: 'PUT', body: JSON.stringify({ apiKey }) })
}

export async function testAiProvider(input: SaveProviderInput) {
  const result = await api<{ result: ProviderTestResult }>('/api/config/provider/test', { method: 'POST', body: JSON.stringify(input) })
  return result.result
}

export async function saveAiProvider(input: SaveProviderInput) {
  return api<{ ok: true; result: ProviderTestResult; config: AiConfigStatus }>('/api/config/provider', { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteRelayProvider() {
  return api<{ ok: true; config: AiConfigStatus }>('/api/config/provider/relay', { method: 'DELETE' })
}

export async function rebuildChapterEmbeddings(chapterId: string) {
  return api<{ ok: true; indexedChunks: number }>('/api/documents/embeddings/rebuild', { method: 'POST', body: JSON.stringify({ chapterId }) })
}

export async function listDocuments(chapterId: string) {
  const result = await api<{ documents: WorkspaceDocument[] }>(`/api/documents?chapterId=${encodeURIComponent(chapterId)}`)
  return result.documents
}

export async function listArchiveRecords() {
  const result = await api<{ records: ArchiveRecord[] }>('/api/archive')
  return result.records
}

export async function updateArchiveStatus(sourceId: string, status: ArchiveManualStatus, note = '') {
  const result = await api<{ records: ArchiveRecord[] }>(`/api/archive/${encodeURIComponent(sourceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  })
  return result.records
}

export async function importArchivePdf(sourceId: string, file: File, chapterId = 'archive') {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('归档资料必须是 PDF 文件。')
  return importDocument(chapterId, sourceId, file)
}

export async function importDocument(
  chapterId: string,
  sourceId: string,
  file: File,
) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const kind = extension === 'pdf' ? 'pdf' : ['md', 'markdown'].includes(extension ?? '') ? 'markdown' : 'html'
  const path = `/api/documents?chapterId=${encodeURIComponent(chapterId)}&sourceId=${encodeURIComponent(sourceId)}&name=${encodeURIComponent(file.name)}&kind=${kind}`
  return api<DocumentImportResult>(path, {
    method: 'PUT',
    body: await file.arrayBuffer(),
    headers: { 'Content-Type': 'application/octet-stream' },
  })
}

export async function deleteDocument(documentId: string) {
  return api<{ ok: true }>(`/api/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' })
}

export async function moveDocument(documentId: string, chapterId: string, sourceId: string) {
  const result = await api<{ document: WorkspaceDocument }>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ chapterId, sourceId }),
  })
  return result.document
}

export async function listArtifacts(chapterId: string, stageKey?: string) {
  const query = new URLSearchParams({ chapterId })
  if (stageKey) query.set('stageKey', stageKey)
  const result = await api<{ artifacts: LearningArtifact[] }>(`/api/artifacts?${query}`)
  return result.artifacts
}

export async function getDocumentPages(documentId: string) {
  const result = await api<{ pages: Array<{ page: number; text: string }> }>(`/api/documents/${encodeURIComponent(documentId)}/pages`)
  return result.pages
}

export async function getDocumentHtml(documentId: string) {
  return api<{ id: string; kind: 'markdown' | 'html'; html: string }>(`/api/documents/${encodeURIComponent(documentId)}/content`)
}

export async function saveArtifact(value: Omit<LearningArtifact, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<LearningArtifact, 'id' | 'createdAt'>>) {
  const result = await api<{ artifact: LearningArtifact }>('/api/artifacts', { method: 'POST', body: JSON.stringify(value) })
  return result.artifact
}

export async function deleteArtifact(artifactId: string) {
  return api<{ ok: true }>(`/api/artifacts/${encodeURIComponent(artifactId)}`, { method: 'DELETE' })
}

export async function askAi(input: {
  chapterId: string
  stageKey?: string
  question: string
  selection?: string
  note?: string
}) {
  const result = await api<{ answer: AiAnswer }>('/api/ai/ask', { method: 'POST', body: JSON.stringify(input) })
  return result.answer
}

export async function getPracticeFeedback(input: {
  stageKey: string
  title: string
  brief: string
  rubric: Array<{ id: string; label: string; criterion: string }>
  answers: Record<string, string>
}) {
  const result = await api<{ feedback: PracticeFeedback }>('/api/ai/practice-feedback', { method: 'POST', body: JSON.stringify(input) })
  return result.feedback
}

export async function listAiAnswers(chapterId: string, stageKey?: string) {
  const query = new URLSearchParams({ chapterId })
  if (stageKey) query.set('stageKey', stageKey)
  const result = await api<{ answers: AiAnswer[] }>(`/api/ai/answers?${query}`)
  return result.answers
}

export async function generateSummary(input: {
  scope: 'stage' | 'chapter'
  targetKey: string
  title: string
  context: string
}) {
  const result = await api<{ summary: LearningSummary }>('/api/ai/summary', { method: 'POST', body: JSON.stringify(input) })
  return result.summary
}

export async function listSummaries(targetKey: string) {
  const result = await api<{ summaries: LearningSummary[] }>(`/api/summaries?targetKey=${encodeURIComponent(targetKey)}`)
  return result.summaries
}

export async function exportWorkspace() {
  const result = await api<{ workspace: Record<string, unknown> }>('/api/export')
  return result.workspace
}

export async function importWorkspace(workspace: unknown) {
  return api<{ imported: { artifacts: number; answers: number; summaries: number } }>('/api/import', {
    method: 'POST',
    body: JSON.stringify(workspace),
  })
}
