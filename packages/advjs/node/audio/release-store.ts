import type { AudioReleasePlan } from '@advjs/audio'
import type { AudioProcessingReceipt } from '@advjs/types'
import type { HostedAudioPublication, HostedAudioReleasePreparation, HostedAudioReleaseReview } from '../../shared/hosted-audio'
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises'
import process from 'node:process'
import { assertAudioProcessingReceipt, canonicalAudioJson } from '@advjs/audio'
import { isAbsolute, relative, resolve } from 'pathe'
import { withProjectWriteLock } from '../project/write-lock'
import { defaultVoiceGenerationStoreDirectory } from './job-store'

export interface StoredAudioRelease {
  review: HostedAudioReleaseReview
  plan: AudioReleasePlan
  consentHashes: Record<string, string>
  /** Current executable source is separate from the native audio document CAS. */
  reviewedProgramSha256: string
}
interface AudioReleaseState {
  schemaVersion: 1
  projectHash: string
  receipts: Record<string, AudioProcessingReceipt>
  plans: Record<string, StoredAudioRelease>
  preparations: Record<string, { state: HostedAudioReleasePreparation, input: { assetIds?: string[], expectedSourceRevision?: string }, createdAt: string }>
  current: HostedAudioPublication | null
}
function inside(root: string, path: string) {
  const coordinate = relative(root, path)
  return !isAbsolute(coordinate) && coordinate !== '..' && !coordinate.startsWith('../')
}

/** Trusted processing evidence and the CAS publication pointer never enter project exports. */
export async function createAudioReleaseStore(projectRoot: string, directory?: string) {
  const project = await realpath(projectRoot)
  const projectHash = createHash('sha256').update(project).digest('hex')
  const coordinate = resolve(directory ?? resolve(defaultVoiceGenerationStoreDirectory(), '../audio-releases', createHash('sha256').update(project).digest('hex')))
  if (inside(project, coordinate))
    throw new Error('AUDIO_RELEASE_STORE_PRIVATE_REQUIRED')
  await mkdir(coordinate, { recursive: true, mode: 0o700 })
  const root = await realpath(coordinate)
  if (inside(project, root))
    throw new Error('AUDIO_RELEASE_STORE_PRIVATE_REQUIRED')
  const path = resolve(root, 'audio-releases.json')
  async function read(): Promise<AudioReleaseState> {
    try {
      const info = await lstat(path)
      if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024 * 1024)
        throw new Error('AUDIO_RELEASE_STORE_INVALID')
      const state = JSON.parse(await readFile(path, 'utf8')) as AudioReleaseState
      if (state.schemaVersion !== 1 || state.projectHash !== projectHash || !state.receipts || !state.plans || !state.preparations || !Object.hasOwn(state, 'current'))
        throw new Error('AUDIO_RELEASE_STORE_INVALID')
      canonicalAudioJson(state)
      for (const receipt of Object.values(state.receipts))
        assertAudioProcessingReceipt(receipt)
      return state
    }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
        return { schemaVersion: 1, projectHash, receipts: {}, plans: {}, preparations: {}, current: null }
      throw error
    }
  }
  async function mutate<T>(operation: (state: AudioReleaseState) => T): Promise<T> {
    return await withProjectWriteLock(root, async () => {
      const state = await read()
      const result = operation(state)
      const content = `${canonicalAudioJson(state)}\n`
      if (new TextEncoder().encode(content).byteLength > 16 * 1024 * 1024)
        throw new Error('AUDIO_RELEASE_STORE_LIMIT')
      const temporary = resolve(root, `.audio-release.${randomUUID()}.tmp`)
      try {
        const file = await open(temporary, 'wx', 0o600)
        try {
          await file.writeFile(content)
          await file.sync()
        }
        finally {
          await file.close()
        }
        await rename(temporary, path)
        if (process.platform !== 'win32') {
          const handle = await open(root, 'r')
          try {
            await handle.sync()
          }
          finally {
            await handle.close()
          }
        }
      }
      finally {
        await rm(temporary, { force: true })
      }
      return structuredClone(result)
    })
  }
  return { read, mutate }
}
