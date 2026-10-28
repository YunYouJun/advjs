import type { ProjectSyncFile } from './cloudSync'
import type { IFileSystem } from './fs'
import { collectProjectFilesForSync } from './cloudSync'
import { isTextFile } from './fs'
import { flushStudioFileMutations, studioFileMutationRevision, whenStudioFileMutationsSettle } from './fs/mutations'
import { runStudioProjectWrite } from './projectAudio'

interface SnapshotFile extends ProjectSyncFile { digest: string }
export type CloudSyncSnapshot = Map<string, SnapshotFile>

export function isCloudSyncPath(path: string): boolean {
  return !!path && !/[\\\0]/.test(path) && path.split('/').every((part, index, parts) => !!part && part !== '.' && part !== '..' && part !== 'node_modules' && (!part.startsWith('.') || index === parts.length - 1))
}

async function digest(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function sameFile(first: SnapshotFile | undefined, second: SnapshotFile | undefined): boolean {
  return first?.digest === second?.digest && first?.lastModified.getTime() === second?.lastModified.getTime()
}

function assertSnapshot(expected: CloudSyncSnapshot, actual: CloudSyncSnapshot) {
  if (expected.size !== actual.size || [...expected].some(([path, file]) => !sameFile(file, actual.get(path))))
    throw new Error('ADV_STUDIO_SOURCE_CONFLICT: Project changed during cloud sync; review the current source before applying')
}

/** Uses the editor's adapter and write queue; network waits happen outside this boundary. */
export function createCloudSyncWorkspace(fs: IFileSystem, assertCurrent: () => void) {
  async function read(scope: IFileSystem): Promise<CloudSyncSnapshot> {
    const files = await collectProjectFilesForSync(scope, '', { strict: true })
    return new Map(await Promise.all(files.map(async file => [file.path, { ...file, digest: await digest(file.content) }] as const)))
  }

  async function capture(): Promise<CloudSyncSnapshot> {
    return runStudioProjectWrite(fs, async () => {
      assertCurrent()
      await whenStudioFileMutationsSettle(fs)
      await flushStudioFileMutations(fs)
      await fs.refresh?.()
      const revision = studioFileMutationRevision(fs)
      const snapshot = await read(fs)
      assertCurrent()
      if (revision !== studioFileMutationRevision(fs))
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT: Project changed while reading the sync source')
      return snapshot
    })
  }

  async function check(expected: CloudSyncSnapshot) {
    assertSnapshot(expected, await capture())
  }

  async function write(scope: IFileSystem, path: string, content: Blob) {
    if (isTextFile(path))
      await scope.writeFile(path, await content.text())
    else
      await scope.writeBlob(path, content)
  }

  async function apply(expected: CloudSyncSnapshot, downloads: Map<string, Blob>): Promise<CloudSyncSnapshot> {
    for (const path of downloads.keys()) {
      if (!isCloudSyncPath(path))
        throw new Error('ADV_STUDIO_SYNC_PATH_INVALID')
    }
    return runStudioProjectWrite(fs, async () => {
      const atomic = !!fs.transaction
      let result!: CloudSyncSnapshot
      async function commit(scope: IFileSystem) {
        assertCurrent()
        await scope.refresh?.()
        assertSnapshot(expected, await read(scope))
        const progress = new Map(expected)
        const written: string[] = []
        try {
          for (const [path, content] of downloads) {
            assertCurrent()
            // Disk adapters cannot lock external writers. Recheck between files
            // and only compensate bytes that are still this operation's writes.
            if (!atomic)
              assertSnapshot(progress, await read(scope))
            await write(scope, path, content)
            written.push(path)
            const current = (await read(scope)).get(path)
            if (!current || current.digest !== await digest(isTextFile(path) ? new Blob([await content.text()]) : content))
              throw new Error('ADV_STUDIO_SYNC_WRITE_MISMATCH')
            progress.set(path, current)
          }
          await scope.flush?.()
          result = await read(scope)
          assertSnapshot(progress, result)
          assertCurrent()
        }
        catch (error) {
          if (!atomic) {
            const failures: unknown[] = []
            for (const path of written.reverse()) {
              try {
                const current = (await read(scope)).get(path)
                if (!sameFile(current, progress.get(path)))
                  continue
                const previous = expected.get(path)
                if (previous)
                  await write(scope, path, previous.content)
                else
                  await scope.deleteFile(path)
              }
              catch (failure) { failures.push(failure) }
            }
            try {
              await scope.flush?.()
            }
            catch (failure) { failures.push(failure) }
            if (failures.length)
              throw new AggregateError([error, ...failures], 'Cloud sync failed; local rollback needs review')
          }
          throw error
        }
      }
      await whenStudioFileMutationsSettle(fs)
      await flushStudioFileMutations(fs)
      if (fs.transaction)
        await fs.transaction(commit, assertCurrent)
      else
        await commit(fs)
      return result
    })
  }

  return { capture, check, apply }
}
