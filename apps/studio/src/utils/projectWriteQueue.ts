import type { IFileSystem } from './fs'

const pendingWrites = new WeakMap<IFileSystem, Promise<void>>()
const barriers = new WeakMap<IFileSystem, string>()
const barrierRevisions = new WeakMap<IFileSystem, number>()
const readinessChecks = new WeakMap<IFileSystem, () => Promise<void>>()

/** The adapter's check only reads durable readiness; it must not enter this queue. */
export function setStudioProjectReadinessCheck(fs: IFileSystem, check: () => Promise<void>) {
  readinessChecks.set(fs, check)
}

async function checkStudioProjectReady(fs: IFileSystem) {
  try {
    await readinessChecks.get(fs)?.()
  }
  catch (error) {
    assertStudioProjectReady(fs)
    throw error
  }
  assertStudioProjectReady(fs)
}

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
  async function commit() {
    // A peer may leave recovery state while this instance waits for its turn.
    if (!options?.recovery)
      await checkStudioProjectReady(fs)
    return operation()
  }
  const next = previous.catch(() => {}).then(() => fs.withWriteLock ? fs.withWriteLock(commit) : commit())
  pendingWrites.set(fs, next.then(() => {}, () => {}))
  return await next
}

/** Include any work queued while an earlier write or its compensation was pending. */
export async function whenStudioProjectWritesSettle(fs: IFileSystem): Promise<void> {
  let previous: Promise<void> | undefined
  do {
    previous = pendingWrites.get(fs)
    await previous?.catch(() => {})
    // Also wait for another native instance's in-flight writes or rollback.
    if (fs.withWriteLock)
      await fs.withWriteLock(() => checkStudioProjectReady(fs))
    else
      await checkStudioProjectReady(fs)
  } while (previous !== pendingWrites.get(fs))
}
