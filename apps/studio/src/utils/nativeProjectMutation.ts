import type { IFileSystem } from './fs'
import { verifyVoiceCandidateBytes } from '@advjs/audio'
import { runStudioProjectWrite } from './projectAudio'

export interface StudioNativeFileChange { path: string, expected: string | null, content: string | null }
export interface StudioNativeMedia { path: string, blob: Blob, sha256: string, bytes: number }

/** Exact-byte CAS and rollback, shared by finite voice mutations and JSON Flow. */
export async function commitStudioProjectFiles(fs: IFileSystem, changes: StudioNativeFileChange[], options: { assertCurrent?: () => void, media?: StudioNativeMedia, acceptsPath: (path: string) => boolean }) {
  if (!Array.isArray(changes) || changes.length > 100 || new Set(changes.map(change => change.path)).size !== changes.length)
    throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  for (const change of changes) {
    if (!options.acceptsPath(change.path) || ![change.expected, change.content].every(value => value === null || typeof value === 'string'))
      throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  }
  const media = options.media
  if (media)
    await verifyVoiceCandidateBytes(media, await media.blob.arrayBuffer())
  return await runStudioProjectWrite(fs, async () => {
    options.assertCurrent?.()
    for (const change of changes) {
      const current = await fs.exists(change.path) ? await fs.readFile(change.path) : null
      if (current !== change.expected)
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    }
    let imported = false
    const written: StudioNativeFileChange[] = []
    try {
      if (media) {
        if (await fs.exists(media.path)) {
          await verifyVoiceCandidateBytes(media, await (await fs.readBlob(media.path)).arrayBuffer())
        }
        else {
          options.assertCurrent?.()
          await fs.writeBlob(media.path, media.blob)
          imported = true
        }
      }
      for (const change of changes) {
        if (change.content === change.expected)
          continue
        options.assertCurrent?.()
        if (change.content === null)
          await fs.deleteFile(change.path)
        else
          await fs.writeFile(change.path, change.content)
        written.push(change)
      }
      options.assertCurrent?.()
    }
    catch (cause) {
      for (const change of written.reverse()) {
        if (change.expected === null)
          await fs.deleteFile(change.path)
        else
          await fs.writeFile(change.path, change.expected)
      }
      if (imported && media)
        await fs.deleteFile(media.path)
      throw cause
    }
  })
}
