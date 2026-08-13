import type {
  AdvAssetGenerationExecutor,
  AdvAssetGenerationTask,
} from '@advjs/assets'
import type { AdvAssetEntry } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import process from 'node:process'
import {
  acceptAdvAssetGenerationCandidate,
  addAdvAssetGenerationCandidate,
  advAssetGenerationCandidateDirectory,
  advAssetGenerationTaskPath,
  assertAdvAssetGenerationCandidatePath,
  createAdvAssetGenerationReceipt,
  createAdvAssetGenerationTask,
  planAdvAssetManifestUpsert,
  registerAdvAssetGenerationTask,
  rejectAdvAssetGenerationCandidate,
  validateAdvAssetGenerationTask,
} from '@advjs/assets'
import { applyProjectPatches } from '@advjs/core'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'pathe'
import { loadProject } from '../project'
import { AdvCommandError } from './errors'

export interface PlanBackgroundAssetOptions {
  root?: string
  sceneId: string
  width?: number
  height?: number
  taskId?: string
  now?: string
}

export interface IngestAssetCandidateOptions {
  root?: string
  taskId: string
  candidatePath: string
  candidateId?: string
  executor: AdvAssetGenerationExecutor
  now?: string
}

export interface RejectAssetCandidateOptions {
  root?: string
  taskId: string
  candidateId: string
  reason: string
  now?: string
}

export interface AcceptAssetCandidateOptions {
  root?: string
  taskId: string
  candidateId: string
  /** Separate approval required when the stable asset ID already points elsewhere. */
  replaceExisting?: boolean
  now?: string
}

export interface ImageMetadata {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  extension: 'png' | 'jpg' | 'webp'
  width: number
  height: number
}

interface TaskFile {
  content: string
  path: string
  task: AdvAssetGenerationTask
}

interface TransactionWrite {
  content: string | Uint8Array
  expected?: string | Uint8Array
  path: string
}

function validationError(message: string, options?: ErrorOptions) {
  return new AdvCommandError('ADV_VALIDATION', message, options)
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function now(value?: string) {
  return value ?? new Date().toISOString()
}

function projectPath(path: string) {
  return path.split(sep).join('/')
}

function isWithin(root: string, target: string) {
  const path = relative(root, target)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

function resolveProjectPath(projectRoot: string, path: string) {
  const target = resolve(projectRoot, path)
  if (!isWithin(projectRoot, target))
    throw validationError(`Project path escapes the project root: ${path}`)
  return target
}

async function exists(path: string) {
  try {
    await stat(path)
    return true
  }
  catch (error) {
    if (isEnoent(error))
      return false
    throw error
  }
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function sameContent(left: Uint8Array, right: Uint8Array) {
  return Buffer.from(left).equals(Buffer.from(right))
}

async function atomicWrite(path: string, content: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = resolve(dirname(path), `.${basename(path)}.${randomUUID()}.advjs-tmp`)
  try {
    await writeFile(temporary, content, { flag: 'wx' })
    await rename(temporary, path)
  }
  finally {
    await rm(temporary, { force: true })
  }
}

async function findExistingDirectory(path: string) {
  let current = path
  while (true) {
    const metadata = await lstat(current).catch((error) => {
      if (isEnoent(error))
        return undefined
      throw error
    })
    if (metadata) {
      const resolved = await realpath(current)
      const resolvedMetadata = await stat(resolved)
      if (!resolvedMetadata.isDirectory())
        throw validationError(`Project write parent is not a directory: ${projectPath(current)}`)
      return resolved
    }
    const parent = dirname(current)
    if (parent === current)
      throw validationError(`Cannot resolve a safe project write parent: ${projectPath(path)}`)
    current = parent
  }
}

async function assertSafeWriteTarget(projectRoot: string, target: string, path: string) {
  const existingParent = await findExistingDirectory(dirname(target))
  if (!isWithin(projectRoot, existingParent))
    throw validationError(`Project write parent escapes the project root: ${path}`)
  await mkdir(dirname(target), { recursive: true })
  const parent = await realpath(dirname(target))
  if (!isWithin(projectRoot, parent))
    throw validationError(`Project write parent escapes the project root: ${path}`)
  const metadata = await lstat(target).catch((error) => {
    if (isEnoent(error))
      return undefined
    throw error
  })
  if (metadata?.isSymbolicLink())
    throw validationError(`Refusing to replace a symbolic link: ${path}`)
}

async function commitProjectWrites(projectRoot: string, writes: TransactionWrite[]) {
  const snapshots = new Map<string, Uint8Array | undefined>()
  const completed: string[] = []
  try {
    for (const write of writes) {
      const target = resolveProjectPath(projectRoot, write.path)
      await assertSafeWriteTarget(projectRoot, target, write.path)
      const current = await readFile(target).catch((error) => {
        if (isEnoent(error))
          return undefined
        throw error
      })
      snapshots.set(target, current)
      if (write.expected !== undefined) {
        if (!current || !sameContent(current, typeof write.expected === 'string' ? Buffer.from(write.expected) : write.expected))
          throw validationError(`Project file changed during asset acceptance: ${write.path}`)
      }
      else if (current) {
        if (sameContent(current, typeof write.content === 'string' ? Buffer.from(write.content) : write.content))
          continue
        throw validationError(`Refusing to overwrite an existing project file: ${write.path}`)
      }
      await atomicWrite(target, write.content)
      completed.push(target)
    }
  }
  catch (error) {
    for (const target of completed.reverse()) {
      const previous = snapshots.get(target)
      if (previous)
        await atomicWrite(target, previous)
      else
        await rm(target, { force: true })
    }
    throw error
  }
}

async function ensureGeneratedIgnore(projectRoot: string) {
  const path = resolve(projectRoot, '.gitignore')
  await assertSafeWriteTarget(projectRoot, path, '.gitignore')
  const current = await readFile(path, 'utf8').catch((error) => {
    if (isEnoent(error))
      return ''
    throw error
  })
  const lines = current.split(/\r?\n/u)
  if (lines.includes('.adv/generated/'))
    return false
  const prefix = current && !current.endsWith('\n') ? `${current}\n` : current
  await atomicWrite(path, `${prefix}.adv/generated/\n`)
  return true
}

function safeGeneratedId(value: string, label: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
  if (!normalized)
    throw validationError(`${label} cannot be converted to a safe id`)
  return normalized
}

function generatedTaskId(sceneId: string, timestamp: string) {
  const date = timestamp.replace(/[-:TZ.]/gu, '').slice(0, 14)
  return `${date}-${safeGeneratedId(sceneId, 'scene id')}-${randomUUID().slice(0, 8)}`
}

async function readTask(projectRoot: string, taskId: string): Promise<TaskFile> {
  const path = advAssetGenerationTaskPath(taskId)
  const content = await readFile(resolveProjectPath(projectRoot, path), 'utf8').catch((error) => {
    if (isEnoent(error))
      throw validationError(`Asset generation task not found: ${taskId}`)
    throw error
  })
  try {
    const task = JSON.parse(content) as AdvAssetGenerationTask
    validateAdvAssetGenerationTask(task)
    return { content, path, task }
  }
  catch (error) {
    throw validationError(`Invalid asset generation task "${taskId}": ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

function readUint24LE(buffer: Buffer, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
}

function readWebpDimensions(buffer: Buffer) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP')
    return undefined
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const data = offset + 8
    if (type === 'VP8X' && size >= 10 && data + 10 <= buffer.length) {
      return {
        width: readUint24LE(buffer, data + 4) + 1,
        height: readUint24LE(buffer, data + 7) + 1,
      }
    }
    if (type === 'VP8 ' && size >= 10 && data + 10 <= buffer.length
      && buffer[data + 3] === 0x9D && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2A) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3FFF,
        height: buffer.readUInt16LE(data + 8) & 0x3FFF,
      }
    }
    if (type === 'VP8L' && size >= 5 && data + 5 <= buffer.length && buffer[data] === 0x2F) {
      const bits = buffer.readUInt32LE(data + 1)
      return {
        width: (bits & 0x3FFF) + 1,
        height: ((bits >> 14) & 0x3FFF) + 1,
      }
    }
    offset = data + size + (size % 2)
  }
}

function readJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8)
    return undefined
  const startOfFrame = new Set([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF])
  let offset = 2
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xFF) {
      offset += 1
      continue
    }
    while (buffer[offset] === 0xFF)
      offset += 1
    const marker = buffer[offset]
    offset += 1
    if (marker === 0xD9 || marker === 0xDA)
      break
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7))
      continue
    if (offset + 2 > buffer.length)
      break
    const length = buffer.readUInt16BE(offset)
    if (length < 2 || offset + length > buffer.length)
      break
    if (startOfFrame.has(marker) && length >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      }
    }
    offset += length
  }
}

export function readImageMetadata(bytes: Uint8Array): ImageMetadata {
  const buffer = Buffer.from(bytes)
  if (buffer.length >= 24
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    && buffer.toString('ascii', 12, 16) === 'IHDR') {
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    if (width > 0 && height > 0)
      return { mimeType: 'image/png', extension: 'png', width, height }
  }
  const webp = readWebpDimensions(buffer)
  if (webp?.width && webp.height)
    return { mimeType: 'image/webp', extension: 'webp', ...webp }
  const jpeg = readJpegDimensions(buffer)
  if (jpeg?.width && jpeg.height)
    return { mimeType: 'image/jpeg', extension: 'jpg', ...jpeg }
  throw validationError('Candidate must be a valid PNG, JPEG, or WebP image with readable dimensions')
}

async function assertCandidateFile(projectRoot: string, taskId: string, candidatePath: string) {
  const normalized = assertAdvAssetGenerationCandidatePath(taskId, projectPath(candidatePath))
  const expectedDirectory = resolveProjectPath(projectRoot, advAssetGenerationCandidateDirectory(taskId))
  const target = resolveProjectPath(projectRoot, normalized)
  const metadata = await lstat(target).catch((error) => {
    if (isEnoent(error))
      throw validationError(`Candidate file not found: ${normalized}`)
    throw error
  })
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw validationError(`Candidate must be a regular file: ${normalized}`)
  const [realDirectory, realTarget] = await Promise.all([realpath(expectedDirectory), realpath(target)])
  if (!isWithin(realDirectory, realTarget))
    throw validationError(`Candidate file escapes its task directory: ${normalized}`)
  return { normalized, target }
}

export async function planBackgroundAssetGeneration(options: PlanBackgroundAssetOptions) {
  const projectRoot = await realpath(resolve(options.root ?? process.cwd()))
  const loaded = await loadProject({ root: projectRoot })
  const scene = loaded.result.project.scenes.find(item => item.id === options.sceneId)
  if (!scene)
    throw validationError(`Scene not found: ${options.sceneId}`)
  if (!scene.imagePrompt?.trim())
    throw validationError(`Scene "${options.sceneId}" has no imagePrompt`)
  const createdAt = now(options.now)
  const task = createAdvAssetGenerationTask({
    id: options.taskId ?? generatedTaskId(scene.id, createdAt),
    projectId: loaded.result.project.id,
    sceneId: scene.id,
    assetId: scene.assetId ?? `background/${scene.id}`,
    prompt: scene.imagePrompt,
    width: options.width ?? 1536,
    height: options.height ?? 864,
    createdAt,
  })
  const taskPath = advAssetGenerationTaskPath(task.id)
  const absoluteTaskPath = resolveProjectPath(projectRoot, taskPath)
  if (await exists(absoluteTaskPath))
    throw validationError(`Asset generation task already exists: ${task.id}`)
  const candidateDirectory = resolveProjectPath(projectRoot, advAssetGenerationCandidateDirectory(task.id))
  await assertSafeWriteTarget(projectRoot, absoluteTaskPath, taskPath)
  await assertSafeWriteTarget(projectRoot, resolve(candidateDirectory, '.candidate-boundary'), `${advAssetGenerationCandidateDirectory(task.id)}/`)
  const gitignoreChanged = await ensureGeneratedIgnore(projectRoot)
  await atomicWrite(absoluteTaskPath, json(task))
  return {
    task,
    taskPath,
    candidateDirectory: advAssetGenerationCandidateDirectory(task.id),
    gitignoreChanged,
  }
}

export async function ingestAssetGenerationCandidate(options: IngestAssetCandidateOptions) {
  const projectRoot = await realpath(resolve(options.root ?? process.cwd()))
  const taskFile = await readTask(projectRoot, options.taskId)
  const candidateFile = await assertCandidateFile(projectRoot, taskFile.task.id, options.candidatePath)
  const bytes = await readFile(candidateFile.target)
  const metadata = readImageMetadata(bytes)
  const generatedAt = now(options.now)
  const fallbackId = basename(candidateFile.normalized, extname(candidateFile.normalized))
  const candidateId = safeGeneratedId(options.candidateId ?? fallbackId, 'candidate id')
  const task = addAdvAssetGenerationCandidate(taskFile.task, {
    id: candidateId,
    path: candidateFile.normalized,
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
    mimeType: metadata.mimeType,
    width: metadata.width,
    height: metadata.height,
    executor: options.executor,
    createdAt: generatedAt,
  })
  await commitProjectWrites(projectRoot, [{
    path: taskFile.path,
    content: json(task),
    expected: taskFile.content,
  }])
  return { task, candidate: task.candidates.at(-1) }
}

export async function rejectAssetGenerationCandidate(options: RejectAssetCandidateOptions) {
  const projectRoot = await realpath(resolve(options.root ?? process.cwd()))
  const taskFile = await readTask(projectRoot, options.taskId)
  const task = rejectAdvAssetGenerationCandidate(
    taskFile.task,
    options.candidateId,
    now(options.now),
    options.reason,
  )
  await commitProjectWrites(projectRoot, [{
    path: taskFile.path,
    content: json(task),
    expected: taskFile.content,
  }])
  return { task }
}

export async function acceptAssetGenerationCandidate(options: AcceptAssetCandidateOptions) {
  const projectRoot = await realpath(resolve(options.root ?? process.cwd()))
  const taskFile = await readTask(projectRoot, options.taskId)
  const reviewedAt = now(options.now)
  const accepted = acceptAdvAssetGenerationCandidate(taskFile.task, options.candidateId, reviewedAt)
  const candidate = accepted.candidates.find(item => item.id === options.candidateId)!
  const candidateFile = await assertCandidateFile(projectRoot, accepted.id, candidate.path)
  const bytes = await readFile(candidateFile.target)
  const metadata = readImageMetadata(bytes)
  const digest = sha256(bytes)
  if (digest !== candidate.sha256
    || bytes.byteLength !== candidate.bytes
    || metadata.mimeType !== candidate.mimeType
    || metadata.width !== candidate.width
    || metadata.height !== candidate.height) {
    throw validationError(`Candidate changed after ingestion: ${candidate.path}`)
  }

  const loaded = await loadProject({ root: projectRoot })
  if (loaded.result.project.id !== accepted.projectId)
    throw validationError(`Task belongs to project "${accepted.projectId}", not "${loaded.result.project.id}"`)
  const scenePath = loaded.result.sourceMap.scenes[accepted.sceneId]
  if (!scenePath)
    throw validationError(`Scene source not found: ${accepted.sceneId}`)
  const extension = metadata.extension
  const assetRelativePath = `backgrounds/${accepted.sceneId}.${digest.slice(0, 12)}.${extension}`
  const assetProjectPath = `${loaded.result.project.root}/assets/${assetRelativePath}`
  const manifestPath = `${loaded.result.project.root}/assets.json`
  const receiptPath = `${loaded.result.project.root}/generations/${accepted.id}.json`
  const entry: AdvAssetEntry = {
    id: accepted.assetId,
    kind: 'background',
    type: 'image',
    path: assetRelativePath,
    sha256: digest,
    bytes: bytes.byteLength,
    mimeType: metadata.mimeType,
    width: metadata.width,
    height: metadata.height,
    sceneId: accepted.sceneId,
    source: {
      type: 'generated',
      model: candidate.executor.model ?? candidate.executor.id,
      promptVersion: accepted.promptVersion,
      createdAt: candidate.createdAt,
    },
  }
  const manifestPlan = planAdvAssetManifestUpsert({
    files: loaded.files,
    rootPath: manifestPath,
    catalogId: accepted.projectId,
    asset: entry,
    replaceExisting: options.replaceExisting,
  })
  const patched = applyProjectPatches(loaded.files, [{
    kind: 'frontmatter-set',
    path: scenePath,
    key: 'assetId',
    value: accepted.assetId,
  }])
  const registered = registerAdvAssetGenerationTask(accepted, {
    assetPath: assetProjectPath,
    manifestPath,
    scenePath,
    receiptPath,
    registeredAt: reviewedAt,
  })
  const receipt = createAdvAssetGenerationReceipt(registered)
  const writes: TransactionWrite[] = [
    { path: assetProjectPath, content: bytes },
    ...Object.entries(manifestPlan.writes).map(([path, content]) => ({
      path,
      content,
      expected: loaded.files[path],
    })),
    {
      path: scenePath,
      content: patched.files[scenePath],
      expected: loaded.files[scenePath],
    },
    { path: receiptPath, content: json(receipt) },
    { path: taskFile.path, content: json(registered), expected: taskFile.content },
  ]
  await commitProjectWrites(projectRoot, writes)
  return {
    task: registered,
    asset: entry,
    receipt,
    writes: writes.map(write => write.path),
  }
}
