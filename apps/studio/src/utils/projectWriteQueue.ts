import type { IFileSystem } from './fs'

const pendingWrites = new WeakMap<IFileSystem, Promise<void>>()
const barriers = new WeakMap<IFileSystem, string>()
const barrierRevisions = new WeakMap<IFileSystem, number>()

export function studioProjectBarrierRevision(fs: IFileSystem) {
  return barrierRevisions.get(fs) ?? 0
}

export function setStudioProjectWriteBarrier(fs: IFileSystem, error?: string) {
  barrierRevisions.set(fs, studioProjectBarrierRevision(fs) + 1)
  if (error)
    barriers.set(fs, error)
  else
    barriers.delete(fs)
}
export function assertStudioProjectReady(fs: IFileSystem) {
  const error = barriers.get(fs)
  if (error)
    throw new Error(error)
}

/** Share one queue across audio, creative adoption, Flow and cloud downloads. */
export async function runStudioProjectWrite<T>(fs: IFileSystem, operation: () => Promise<T>, options?: { recovery?: boolean }): Promise<T> {
  const previous = pendingWrites.get(fs) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => {
    if (!options?.recovery)
      assertStudioProjectReady(fs)
    return operation()
  })
  pendingWrites.set(fs, next.then(() => {}, () => {}))
  return await next
}

/** Include any work queued while an earlier write or its compensation was pending. */
export async function whenStudioProjectWritesSettle(fs: IFileSystem): Promise<void> {
  let previous: Promise<void> | undefined
  do {
    previous = pendingWrites.get(fs)
    await previous?.catch(() => {})
  } while (previous !== pendingWrites.get(fs))
  assertStudioProjectReady(fs)
}
