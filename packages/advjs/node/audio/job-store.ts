import type { VoiceGenerationStore, VoiceGenerationStoreDocument } from '@advjs/audio'
import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import process from 'node:process'
import { canonicalAudioJson, emptyVoiceGenerationStore, parseVoiceGenerationStore, pruneVoiceGenerationStore, VOICE_GENERATION_RECEIPT_MAX_BYTES } from '@advjs/audio'
import { isAbsolute, relative, resolve } from 'pathe'
import { withProjectWriteLock } from '../project/write-lock'

export const VOICE_GENERATION_STORE_MAX_BYTES = 64 * 1024 * 1024
const emergencyHeadroom = 64 * 1024

/** Reserve compact final identities and bounded in-flight receipts before billing. */
export function assertVoiceGenerationStoreCapacity(state: VoiceGenerationStoreDocument) {
  const future = new Set<string>()
  let pendingTasks = 0
  let concurrency = 0
  for (const job of Object.values(state.jobs)) {
    const pending = job.tasks.filter(task => !['committed', 'cancelled', 'failed'].includes(task.status))
    if (pending.length)
      concurrency += job.budget.concurrency
    pendingTasks += pending.length
    for (const task of pending) {
      const record = state.idempotency[task.idempotencyKey]
      if (!record || record.status === 'failed')
        future.add(task.idempotencyKey)
    }
  }
  const unresolved = Object.values(state.idempotency).filter(record => ['running', 'unknown'].includes(record.status))
  const running = unresolved.filter(record => record.status === 'running').length
  const unknown = unresolved.length - running
  const receiptSlots = unknown + Math.max(running, Math.min(future.size + running, concurrency))
  const reserved = future.size * 4096 + pendingTasks * 256 + receiptSlots * VOICE_GENERATION_RECEIPT_MAX_BYTES
  if (new TextEncoder().encode(canonicalAudioJson(state)).byteLength + reserved > VOICE_GENERATION_STORE_MAX_BYTES - emergencyHeadroom)
    throw new Error('AUDIO_JOB_STORE_CAPACITY: Insufficient durable recovery space; reduce or finish queued work before synthesis')
}

export function defaultVoiceGenerationStoreDirectory() {
  const base = process.platform === 'darwin'
    ? resolve(homedir(), 'Library/Application Support')
    : process.platform === 'win32'
      ? process.env.LOCALAPPDATA ?? resolve(homedir(), 'AppData/Local')
      : process.env.XDG_DATA_HOME ?? resolve(homedir(), '.local/share')
  return resolve(base, 'ADV.JS/audio-jobs')
}

function inside(root: string, path: string) {
  const coordinate = relative(root, path)
  return !isAbsolute(coordinate) && coordinate !== '..' && !coordinate.startsWith('../')
}

/** Durable local state belongs to OS application data, never project Git/export. */
export async function createNodeVoiceGenerationStore(options: { projectRoot: string, directory?: string }): Promise<VoiceGenerationStore> {
  const projectRoot = await realpath(resolve(options.projectRoot))
  const directory = resolve(options.directory ?? defaultVoiceGenerationStoreDirectory())
  if (inside(projectRoot, directory))
    throw new Error('AUDIO_JOB_STORE_PROJECT_PATH: Job state must remain outside the project')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const root = await realpath(directory)
  if (inside(projectRoot, root))
    throw new Error('AUDIO_JOB_STORE_PROJECT_PATH: Job state cannot resolve into the project')
  const path = resolve(root, 'audio-jobs.json')
  async function read(): Promise<VoiceGenerationStoreDocument> {
    try {
      const target = await realpath(path)
      const info = await stat(target)
      if (!inside(root, target) || !info.isFile() || info.size > VOICE_GENERATION_STORE_MAX_BYTES)
        throw new Error('AUDIO_JOB_STORE_INVALID: Invalid or oversized application-data store')
      return parseVoiceGenerationStore(JSON.parse(await readFile(target, 'utf8')))
    }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
        return emptyVoiceGenerationStore()
      throw error
    }
  }
  return {
    read,
    async assertCapacity(plan) {
      const state = pruneVoiceGenerationStore(await read(), Date.now())
      if (plan && !state.jobs[plan.id])
        state.jobs[plan.id] = structuredClone(plan)
      assertVoiceGenerationStoreCapacity(state)
    },
    async mutate<T>(mutation: (document: VoiceGenerationStoreDocument) => T) {
      return await withProjectWriteLock(root, async () => {
        const state = await read()
        const jobIds = new Set(Object.keys(state.jobs))
        const claims = new Map(Object.entries(state.idempotency).filter(([, record]) => record.status === 'running').map(([key, record]) => [key, record.dispatchId]))
        const result = mutation(state)
        let checked = parseVoiceGenerationStore(state)
        const newJob = Object.keys(checked.jobs).some(id => !jobIds.has(id))
        if (newJob)
          checked = pruneVoiceGenerationStore(checked, Date.now())
        const newClaim = Object.entries(checked.idempotency).some(([key, record]) => record.status === 'running' && (!claims.has(key) || claims.get(key) !== record.dispatchId))
        // Control and failure updates retain emergency room; every new dispatch
        // atomically rechecks the allowance, including other concurrent jobs.
        if (newJob || newClaim)
          assertVoiceGenerationStoreCapacity(checked)
        const content = canonicalAudioJson(checked)
        if (new TextEncoder().encode(content).byteLength + 1 > VOICE_GENERATION_STORE_MAX_BYTES)
          throw new Error('AUDIO_JOB_STORE_LIMIT: Prune expired terminal jobs before adding more application state')
        const temporary = resolve(root, `.audio-jobs.${randomUUID()}.tmp`)
        try {
          const file = await open(temporary, 'wx', 0o600)
          try {
            await file.writeFile(`${content}\n`)
            await file.sync()
          }
          finally {
            await file.close()
          }
          await rename(temporary, path)
          if (process.platform !== 'win32') {
            const directoryHandle = await open(root, 'r')
            try {
              await directoryHandle.sync()
            }
            finally {
              await directoryHandle.close()
            }
          }
        }
        finally {
          await rm(temporary, { force: true })
        }
        return structuredClone(result)
      })
    },
  }
}
