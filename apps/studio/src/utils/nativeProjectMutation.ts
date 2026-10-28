import type { IFileSystem } from './fs'
import { verifyVoiceCandidateBytes } from '@advjs/audio'
import { runStudioProjectWrite } from './projectWriteQueue'

export interface StudioNativeFileChange { path: string, expected: string | null, content: string | null }
export interface StudioNativeMedia { path: string, blob: Blob, sha256: string, bytes: number, exclusive?: boolean }

async function sourceContent(fs: IFileSystem, path: string): Promise<string | null> {
  return await fs.exists(path) ? fs.readFile(path) : null
}

/** Exact-byte CAS and rollback, shared by finite voice mutations and JSON Flow. */
export async function commitStudioProjectFiles(fs: IFileSystem, changes: StudioNativeFileChange[], options: { assertCurrent?: () => void, validateCurrent?: (scope: IFileSystem) => Promise<void>, validateAfter?: (scope: IFileSystem) => Promise<void>, media?: StudioNativeMedia | readonly StudioNativeMedia[], acceptsPath: (path: string) => boolean, acceptsMediaPath?: (path: string) => boolean }) {
  if (!Array.isArray(changes) || changes.length > 100 || new Set(changes.map(change => change.path)).size !== changes.length)
    throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  for (const change of changes) {
    if (!options.acceptsPath(change.path) || ![change.expected, change.content].every(value => value === null || typeof value === 'string'))
      throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  }
  const media = options.media ? (Array.isArray(options.media) ? options.media : [options.media]) as readonly StudioNativeMedia[] : []
  if (media.length > 32 || new Set(media.map(item => item.path)).size !== media.length || media.reduce((bytes, item) => bytes + item.bytes, 0) > 64 * 1024 * 1024
    || media.some(item => !(options.acceptsMediaPath?.(item.path) ?? /^[\w./-]+$/.test(item.path)) || /^(?:[a-z]+:|\/)/i.test(item.path) || item.path.includes('\\') || Array.from(item.path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || item.path.split('/').some(part => ['', '.', '..', '.git', 'node_modules'].includes(part.toLowerCase())) || changes.some(change => change.path === item.path))) {
    throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  }
  for (const item of media)
    await verifyVoiceCandidateBytes(item, await item.blob.arrayBuffer())
  async function commit(scope: IFileSystem) {
    options.assertCurrent?.()
    await options.validateCurrent?.(scope)
    for (const change of changes) {
      const current = await sourceContent(scope, change.path)
      if (current !== change.expected)
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    }
    const imported: StudioNativeMedia[] = []
    const written: StudioNativeFileChange[] = []
    try {
      for (const item of media) {
        if (await scope.exists(item.path)) {
          if (item.exclusive)
            throw new Error('ADV_STUDIO_MEDIA_EXISTS: This import requires a new immutable path')
          await verifyVoiceCandidateBytes(item, await (await scope.readBlob(item.path)).arrayBuffer())
        }
        else {
          options.assertCurrent?.()
          imported.push(item)
          await scope.writeBlob(item.path, item.blob)
        }
      }
      for (const change of changes) {
        if (change.content === change.expected)
          continue
        options.assertCurrent?.()
        // A disk adapter may have another writer between the batch check and
        // this file. It has no isolated transaction view to protect that gap.
        if (await sourceContent(scope, change.path) !== change.expected)
          throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
        options.assertCurrent?.()
        written.push(change)
        if (change.content === null)
          await scope.deleteFile(change.path)
        else
          await scope.writeFile(change.path, change.content)
      }
      await scope.flush?.()
      options.assertCurrent?.()
      await options.validateAfter?.(scope)
      options.assertCurrent?.()
    }
    catch (cause) {
      // Atomic adapters discard their isolated view; never issue compensating
      // writes that could overwrite a winning external commit.
      if (scope !== fs)
        throw cause
      const failures: unknown[] = []
      for (const change of written.reverse()) {
        try {
          const actual = await sourceContent(scope, change.path)
          if (actual === change.expected)
            continue
          if (actual !== change.content)
            throw new Error(`ADV_STUDIO_ROLLBACK_SOURCE_CHANGED: ${change.path}`)
          if (change.expected === null)
            await scope.deleteFile(change.path)
          else
            await scope.writeFile(change.path, change.expected)
        }
        catch (error) {
          failures.push(error)
        }
      }
      // An independent author file may now reference these media. Keep the
      // imported bytes if the saved baseline cannot be restored or verified.
      if (!failures.length) {
        try {
          await options.validateCurrent?.(scope)
        }
        catch (error) {
          failures.push(error)
        }
      }
      if (!failures.length) {
        for (const item of imported.reverse()) {
          try {
            await options.validateCurrent?.(scope)
            if (await scope.exists(item.path)) {
              await verifyVoiceCandidateBytes(item, await (await scope.readBlob(item.path)).arrayBuffer())
              await scope.deleteFile(item.path)
            }
          }
          catch (error) {
            failures.push(error)
          }
        }
      }
      try {
        await scope.flush?.()
      }
      catch (error) {
        failures.push(error)
      }
      if (failures.length)
        throw new AggregateError(failures, 'ADV_STUDIO_ROLLBACK_INCOMPLETE', { cause })
      throw cause
    }
  }
  return await runStudioProjectWrite(fs, async () => {
    if (fs.transaction)
      await fs.transaction(commit, options.assertCurrent)
    else
      await commit(fs)
  })
}
