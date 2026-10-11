import type { VoiceGenerationStore, VoiceGenerationStoreDocument } from '@advjs/audio'
import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import process from 'node:process'
import { canonicalAudioJson, emptyVoiceGenerationStore, parseVoiceGenerationStore } from '@advjs/audio'
import { isAbsolute, relative, resolve } from 'pathe'
import { withProjectWriteLock } from '../project/write-lock'

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
      if (!inside(root, target) || !info.isFile() || info.size > 10 * 1024 * 1024)
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
    async mutate<T>(mutation: (document: VoiceGenerationStoreDocument) => T) {
      return await withProjectWriteLock(root, async () => {
        const state = await read()
        const result = mutation(state)
        const checked = parseVoiceGenerationStore(state)
        const content = canonicalAudioJson(checked)
        if (new TextEncoder().encode(content).byteLength > 10 * 1024 * 1024)
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
