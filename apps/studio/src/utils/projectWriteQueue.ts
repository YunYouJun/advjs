import type { IFileSystem } from './fs'

const pendingWrites = new WeakMap<IFileSystem, Promise<void>>()

/** Share one queue across audio, creative adoption, Flow and cloud downloads. */
export async function runStudioProjectWrite<T>(fs: IFileSystem, operation: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(fs) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(operation)
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
}
