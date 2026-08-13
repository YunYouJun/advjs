export const ADV_ASSET_GENERATION_SCHEMA_VERSION = 1 as const
export const ADV_ASSET_GENERATION_RECEIPT_SCHEMA_VERSION = 1 as const

export type AdvAssetGenerationKind = 'background'
export type AdvAssetGenerationTaskStatus = 'planned' | 'generated' | 'reviewed' | 'accepted' | 'registered'
export type AdvAssetGenerationCandidateStatus = 'generated' | 'rejected' | 'accepted'

export interface AdvAssetGenerationExecutor {
  id: string
  model?: string
  revision?: string
}

export interface AdvAssetGenerationTarget {
  width: number
  height: number
  aspectRatio: string
}

export interface AdvAssetGenerationCandidate {
  id: string
  path: string
  sha256: string
  bytes: number
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
  executor: AdvAssetGenerationExecutor
  status: AdvAssetGenerationCandidateStatus
  createdAt: string
  reviewedAt?: string
  rejectionReason?: string
}

export interface AdvAssetGenerationRegistration {
  assetPath: string
  manifestPath: string
  scenePath: string
  receiptPath: string
  registeredAt: string
}

export interface AdvAssetGenerationTask {
  schemaVersion: typeof ADV_ASSET_GENERATION_SCHEMA_VERSION
  id: string
  projectId: string
  kind: AdvAssetGenerationKind
  sceneId: string
  assetId: string
  prompt: string
  promptVersion?: string
  target: AdvAssetGenerationTarget
  status: AdvAssetGenerationTaskStatus
  createdAt: string
  updatedAt: string
  candidates: AdvAssetGenerationCandidate[]
  registration?: AdvAssetGenerationRegistration
}

export interface CreateAdvAssetGenerationTaskInput {
  id: string
  projectId: string
  sceneId: string
  assetId?: string
  prompt: string
  promptVersion?: string
  width: number
  height: number
  createdAt: string
}

export interface AddAdvAssetGenerationCandidateInput {
  id: string
  path: string
  sha256: string
  bytes: number
  mimeType: AdvAssetGenerationCandidate['mimeType']
  width: number
  height: number
  executor: AdvAssetGenerationExecutor
  createdAt: string
}

export interface AdvAssetGenerationReceipt {
  schemaVersion: typeof ADV_ASSET_GENERATION_RECEIPT_SCHEMA_VERSION
  taskId: string
  projectId: string
  kind: AdvAssetGenerationKind
  sceneId: string
  assetId: string
  prompt: string
  promptVersion?: string
  target: AdvAssetGenerationTarget
  candidate: Omit<AdvAssetGenerationCandidate, 'status' | 'rejectionReason'>
  registration: AdvAssetGenerationRegistration
}

const SAFE_ID_RE = /^[a-z0-9][a-z0-9._-]*$/u
const SHA256_RE = /^[a-f0-9]{64}$/u
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u
const MIME_TYPES = new Set<AdvAssetGenerationCandidate['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const TASK_STATUSES = new Set<AdvAssetGenerationTaskStatus>(['planned', 'generated', 'reviewed', 'accepted', 'registered'])
const CANDIDATE_STATUSES = new Set<AdvAssetGenerationCandidateStatus>(['generated', 'rejected', 'accepted'])

function fail(message: string): never {
  throw new Error(`ADV_ASSET_WORKFLOW_INVALID: ${message}`)
}

function assertSafeId(value: string, label: string) {
  if (!SAFE_ID_RE.test(value))
    fail(`${label} must use lowercase letters, digits, dots, underscores, or hyphens`)
}

function assertNonEmpty(value: string, label: string) {
  if (!value.trim())
    fail(`${label} must not be empty`)
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0)
    fail(`${label} must be a positive integer`)
}

function assertIsoDate(value: string, label: string) {
  if (!ISO_DATE_RE.test(value) || Number.isNaN(Date.parse(value)))
    fail(`${label} must be an ISO UTC timestamp`)
}

function normalizeProjectPath(path: string) {
  const normalized = path.replaceAll('\\', '/')
  const segments = normalized.split('/').filter(segment => segment && segment !== '.')
  if (normalized.startsWith('/') || segments.length === 0 || segments.includes('..'))
    fail(`path must be project-relative: ${path}`)
  return segments.join('/')
}

function cloneTask(task: AdvAssetGenerationTask): AdvAssetGenerationTask {
  return {
    ...task,
    target: { ...task.target },
    candidates: task.candidates.map(candidate => ({
      ...candidate,
      executor: { ...candidate.executor },
    })),
    registration: task.registration ? { ...task.registration } : undefined,
  }
}

export function advAssetGenerationTaskDirectory(taskId: string) {
  assertSafeId(taskId, 'task id')
  return `.adv/generated/tasks/${taskId}`
}

export function advAssetGenerationCandidateDirectory(taskId: string) {
  return `${advAssetGenerationTaskDirectory(taskId)}/candidates`
}

export function advAssetGenerationTaskPath(taskId: string) {
  return `${advAssetGenerationTaskDirectory(taskId)}/task.json`
}

export function assertAdvAssetGenerationCandidatePath(taskId: string, path: string) {
  const normalized = normalizeProjectPath(path)
  const prefix = `${advAssetGenerationCandidateDirectory(taskId)}/`
  if (!normalized.startsWith(prefix) || normalized.length === prefix.length)
    fail(`candidate path must be owned by task "${taskId}"`)
  return normalized
}

export function createAdvAssetGenerationTask(input: CreateAdvAssetGenerationTaskInput): AdvAssetGenerationTask {
  assertSafeId(input.id, 'task id')
  assertNonEmpty(input.projectId, 'project id')
  assertSafeId(input.sceneId, 'scene id')
  assertNonEmpty(input.prompt, 'prompt')
  assertPositiveInteger(input.width, 'target width')
  assertPositiveInteger(input.height, 'target height')
  assertIsoDate(input.createdAt, 'createdAt')
  const divisor = greatestCommonDivisor(input.width, input.height)
  return {
    schemaVersion: ADV_ASSET_GENERATION_SCHEMA_VERSION,
    id: input.id,
    projectId: input.projectId,
    kind: 'background',
    sceneId: input.sceneId,
    assetId: input.assetId ?? `background/${input.sceneId}`,
    prompt: input.prompt.trim(),
    promptVersion: input.promptVersion,
    target: {
      width: input.width,
      height: input.height,
      aspectRatio: `${input.width / divisor}:${input.height / divisor}`,
    },
    status: 'planned',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    candidates: [],
  }
}

export function addAdvAssetGenerationCandidate(
  task: AdvAssetGenerationTask,
  input: AddAdvAssetGenerationCandidateInput,
): AdvAssetGenerationTask {
  validateAdvAssetGenerationTask(task)
  if (task.status === 'accepted' || task.status === 'registered')
    fail(`task "${task.id}" no longer accepts candidates`)
  assertSafeId(input.id, 'candidate id')
  if (task.candidates.some(candidate => candidate.id === input.id))
    fail(`duplicate candidate id: ${input.id}`)
  const path = assertAdvAssetGenerationCandidatePath(task.id, input.path)
  if (!SHA256_RE.test(input.sha256))
    fail('candidate sha256 must be a lowercase SHA-256 digest')
  assertPositiveInteger(input.bytes, 'candidate bytes')
  assertPositiveInteger(input.width, 'candidate width')
  assertPositiveInteger(input.height, 'candidate height')
  if (!MIME_TYPES.has(input.mimeType))
    fail(`unsupported candidate media type: ${input.mimeType}`)
  assertNonEmpty(input.executor.id, 'executor id')
  assertIsoDate(input.createdAt, 'candidate createdAt')

  const next = cloneTask(task)
  next.candidates.push({
    ...input,
    path,
    executor: { ...input.executor },
    status: 'generated',
  })
  next.status = 'generated'
  next.updatedAt = input.createdAt
  return next
}

export function rejectAdvAssetGenerationCandidate(
  task: AdvAssetGenerationTask,
  candidateId: string,
  reviewedAt: string,
  reason: string,
): AdvAssetGenerationTask {
  validateAdvAssetGenerationTask(task)
  assertIsoDate(reviewedAt, 'reviewedAt')
  assertNonEmpty(reason, 'rejection reason')
  if (task.status === 'accepted' || task.status === 'registered')
    fail(`task "${task.id}" has already been accepted`)
  const next = cloneTask(task)
  const candidate = next.candidates.find(item => item.id === candidateId)
  if (!candidate)
    fail(`unknown candidate: ${candidateId}`)
  if (candidate.status !== 'generated')
    fail(`candidate "${candidateId}" is already ${candidate.status}`)
  candidate.status = 'rejected'
  candidate.reviewedAt = reviewedAt
  candidate.rejectionReason = reason.trim()
  next.status = 'reviewed'
  next.updatedAt = reviewedAt
  return next
}

export function acceptAdvAssetGenerationCandidate(
  task: AdvAssetGenerationTask,
  candidateId: string,
  reviewedAt: string,
): AdvAssetGenerationTask {
  validateAdvAssetGenerationTask(task)
  assertIsoDate(reviewedAt, 'reviewedAt')
  if (task.status === 'accepted' || task.status === 'registered')
    fail(`task "${task.id}" has already been accepted`)
  const next = cloneTask(task)
  const candidate = next.candidates.find(item => item.id === candidateId)
  if (!candidate)
    fail(`unknown candidate: ${candidateId}`)
  if (candidate.status !== 'generated')
    fail(`candidate "${candidateId}" is already ${candidate.status}`)
  candidate.status = 'accepted'
  candidate.reviewedAt = reviewedAt
  next.status = 'accepted'
  next.updatedAt = reviewedAt
  return next
}

export function registerAdvAssetGenerationTask(
  task: AdvAssetGenerationTask,
  registration: AdvAssetGenerationRegistration,
): AdvAssetGenerationTask {
  validateAdvAssetGenerationTask(task)
  if (task.status !== 'accepted')
    fail(`task "${task.id}" must be accepted before registration`)
  assertIsoDate(registration.registeredAt, 'registeredAt')
  const next = cloneTask(task)
  next.registration = {
    assetPath: normalizeProjectPath(registration.assetPath),
    manifestPath: normalizeProjectPath(registration.manifestPath),
    scenePath: normalizeProjectPath(registration.scenePath),
    receiptPath: normalizeProjectPath(registration.receiptPath),
    registeredAt: registration.registeredAt,
  }
  next.status = 'registered'
  next.updatedAt = registration.registeredAt
  return next
}

export function createAdvAssetGenerationReceipt(task: AdvAssetGenerationTask): AdvAssetGenerationReceipt {
  validateAdvAssetGenerationTask(task)
  if (task.status !== 'registered' || !task.registration)
    fail(`task "${task.id}" must be registered before creating a receipt`)
  const candidate = task.candidates.find(item => item.status === 'accepted')
  if (!candidate)
    fail(`task "${task.id}" has no accepted candidate`)
  const { rejectionReason: _rejectionReason, status: _status, ...acceptedCandidate } = candidate
  return {
    schemaVersion: ADV_ASSET_GENERATION_RECEIPT_SCHEMA_VERSION,
    taskId: task.id,
    projectId: task.projectId,
    kind: task.kind,
    sceneId: task.sceneId,
    assetId: task.assetId,
    prompt: task.prompt,
    promptVersion: task.promptVersion,
    target: { ...task.target },
    candidate: {
      ...acceptedCandidate,
      executor: { ...acceptedCandidate.executor },
    },
    registration: { ...task.registration },
  }
}

export function validateAdvAssetGenerationTask(task: AdvAssetGenerationTask) {
  if (task.schemaVersion !== ADV_ASSET_GENERATION_SCHEMA_VERSION)
    fail(`unsupported task schema version: ${task.schemaVersion}`)
  assertSafeId(task.id, 'task id')
  assertNonEmpty(task.projectId, 'project id')
  assertSafeId(task.sceneId, 'scene id')
  assertNonEmpty(task.assetId, 'asset id')
  assertNonEmpty(task.prompt, 'prompt')
  if (!TASK_STATUSES.has(task.status))
    fail(`unsupported task status: ${task.status}`)
  assertPositiveInteger(task.target.width, 'target width')
  assertPositiveInteger(task.target.height, 'target height')
  assertIsoDate(task.createdAt, 'createdAt')
  assertIsoDate(task.updatedAt, 'updatedAt')
  const candidateIds = new Set<string>()
  let acceptedCandidates = 0
  let generatedCandidates = 0
  let rejectedCandidates = 0
  for (const candidate of task.candidates) {
    assertSafeId(candidate.id, 'candidate id')
    if (candidateIds.has(candidate.id))
      fail(`duplicate candidate id: ${candidate.id}`)
    candidateIds.add(candidate.id)
    assertAdvAssetGenerationCandidatePath(task.id, candidate.path)
    if (!SHA256_RE.test(candidate.sha256))
      fail(`candidate "${candidate.id}" has an invalid sha256`)
    assertPositiveInteger(candidate.bytes, 'candidate bytes')
    assertPositiveInteger(candidate.width, 'candidate width')
    assertPositiveInteger(candidate.height, 'candidate height')
    if (!MIME_TYPES.has(candidate.mimeType))
      fail(`unsupported candidate media type: ${candidate.mimeType}`)
    if (!CANDIDATE_STATUSES.has(candidate.status))
      fail(`unsupported candidate status: ${candidate.status}`)
    assertNonEmpty(candidate.executor.id, 'executor id')
    assertIsoDate(candidate.createdAt, 'candidate createdAt')
    if (candidate.status === 'generated') {
      generatedCandidates += 1
      if (candidate.reviewedAt || candidate.rejectionReason)
        fail(`generated candidate "${candidate.id}" must not contain review metadata`)
    }
    else {
      if (!candidate.reviewedAt)
        fail(`${candidate.status} candidate "${candidate.id}" must declare reviewedAt`)
      assertIsoDate(candidate.reviewedAt, 'candidate reviewedAt')
      if (candidate.status === 'accepted') {
        acceptedCandidates += 1
        if (candidate.rejectionReason)
          fail(`accepted candidate "${candidate.id}" must not contain a rejection reason`)
      }
      else {
        rejectedCandidates += 1
        if (!candidate.rejectionReason?.trim())
          fail(`rejected candidate "${candidate.id}" must declare a rejection reason`)
      }
    }
  }
  if (acceptedCandidates > 1)
    fail(`task "${task.id}" must not contain multiple accepted candidates`)
  if (task.status === 'planned' && task.candidates.length > 0)
    fail(`planned task "${task.id}" must not contain candidates`)
  if (task.status === 'generated' && generatedCandidates === 0)
    fail(`generated task "${task.id}" must contain a generated candidate`)
  if (acceptedCandidates > 0 && task.status !== 'accepted' && task.status !== 'registered')
    fail(`${task.status} task "${task.id}" must not contain an accepted candidate`)
  if (task.status === 'reviewed' && (rejectedCandidates === 0 || acceptedCandidates > 0))
    fail(`reviewed task "${task.id}" must contain a rejection and no accepted candidate`)
  if ((task.status === 'accepted' || task.status === 'registered') && acceptedCandidates !== 1)
    fail(`${task.status} task "${task.id}" must contain exactly one accepted candidate`)
  if (task.status === 'registered') {
    if (!task.registration)
      fail(`registered task "${task.id}" must declare registration metadata`)
    for (const [label, path] of Object.entries({
      assetPath: task.registration.assetPath,
      manifestPath: task.registration.manifestPath,
      scenePath: task.registration.scenePath,
      receiptPath: task.registration.receiptPath,
    })) {
      normalizeProjectPath(path)
      assertNonEmpty(path, `registration ${label}`)
    }
    assertIsoDate(task.registration.registeredAt, 'registeredAt')
  }
  else if (task.registration) {
    fail(`${task.status} task "${task.id}" must not contain registration metadata`)
  }
  return task
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left
  let b = right
  while (b !== 0)
    [a, b] = [b, a % b]
  return a
}
