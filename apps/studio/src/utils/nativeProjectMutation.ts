import type { IFileSystem } from './fs'
import { verifyVoiceCandidateBytes } from '@advjs/audio'
import { runStudioProjectWrite } from './projectAudio'

export interface StudioNativeFileChange { path: string, expected: string | null, content: string | null }
export interface StudioNativeMedia { path: string, blob: Blob, sha256: string, bytes: number }

/** Exact-byte CAS and rollback, shared by finite voice mutations and JSON Flow. */
export async function commitStudioProjectFiles(fs: IFileSystem, changes: StudioNativeFileChange[], options: { assertCurrent?: () => void, validateCurrent?: () => Promise<void>, validateAfter?: () => Promise<void>, media?: StudioNativeMedia | readonly StudioNativeMedia[], acceptsPath: (path: string) => boolean }) {
  if (!Array.isArray(changes) || changes.length > 100 || new Set(changes.map(change => change.path)).size !== changes.length)
    throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  for (const change of changes) {
    if (!options.acceptsPath(change.path) || ![change.expected, change.content].every(value => value === null || typeof value === 'string'))
      throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  }
  const media = options.media ? (Array.isArray(options.media) ? options.media : [options.media]) as readonly StudioNativeMedia[] : []
  if (media.length > 32 || new Set(media.map(item => item.path)).size !== media.length || media.reduce((bytes, item) => bytes + item.bytes, 0) > 64 * 1024 * 1024
    || media.some(item => !/^[\w./-]+$/.test(item.path) || item.path.split('/').some(part => ['', '.', '..'].includes(part)) || changes.some(change => change.path === item.path))) {
    throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  }
  for (const item of media)
    await verifyVoiceCandidateBytes(item, await item.blob.arrayBuffer())
  return await runStudioProjectWrite(fs, async () => {
    options.assertCurrent?.()
    await options.validateCurrent?.()
    for (const change of changes) {
      const current = await fs.exists(change.path) ? await fs.readFile(change.path) : null
      if (current !== change.expected)
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    }
    const imported: string[] = []
    const written: StudioNativeFileChange[] = []
    try {
      for (const item of media) {
        if (await fs.exists(item.path)) {
          await verifyVoiceCandidateBytes(item, await (await fs.readBlob(item.path)).arrayBuffer())
        }
        else {
          options.assertCurrent?.()
          imported.push(item.path)
          await fs.writeBlob(item.path, item.blob)
        }
      }
      for (const change of changes) {
        if (change.content === change.expected)
          continue
        options.assertCurrent?.()
        written.push(change)
        if (change.content === null)
          await fs.deleteFile(change.path)
        else
          await fs.writeFile(change.path, change.content)
      }
      await fs.flush?.()
      options.assertCurrent?.()
      await options.validateAfter?.()
      options.assertCurrent?.()
    }
    catch (cause) {
      for (const change of written.reverse()) {
        if (change.expected === null) {
          if (await fs.exists(change.path))
            await fs.deleteFile(change.path)
        }
        else {
          await fs.writeFile(change.path, change.expected)
        }
      }
      for (const path of imported.reverse()) {
        if (await fs.exists(path))
          await fs.deleteFile(path)
      }
      await fs.flush?.()
      throw cause
    }
  })
}
