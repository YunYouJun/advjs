import { mkdir, open, realpath, rm } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'pathe'
import { AdvCommandError } from '../commands/errors'

const pendingWrites = new Map<string, Promise<unknown>>()

/** Serialize cooperating project writers across Editor/MCP processes. Call once per operation; nested locking is unsupported. */
export async function withProjectWriteLock<T>(root: string, write: (realRoot: string) => Promise<T>): Promise<T> {
  const realRoot = await realpath(resolve(root))
  const previous = pendingWrites.get(realRoot) ?? Promise.resolve()
  const operation = previous.then(async () => {
    const directory = resolve(realRoot, '.advjs')
    await mkdir(directory, { recursive: true })
    const lockDirectory = await realpath(directory)
    const path = relative(realRoot, lockDirectory)
    if (isAbsolute(path) || path === '..' || path.startsWith('../'))
      throw new AdvCommandError('ADV_VALIDATION', 'Project lock directory escapes the project')
    const lockPath = resolve(lockDirectory, 'catalog-write.lock')
    const deadline = Date.now() + 3000
    let lock
    while (!lock) {
      try {
        lock = await open(lockPath, 'wx')
      }
      catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST')
          throw error
        if (Date.now() >= deadline)
          throw new AdvCommandError('ADV_VALIDATION', 'VOICE_CONFLICT: Another project writer is active. Retry after it finishes; remove a stale .advjs/catalog-write.lock only after its writer has stopped.')
        await new Promise(resolveWait => setTimeout(resolveWait, 25))
      }
    }
    try {
      return await write(realRoot)
    }
    finally {
      await lock.close()
      await rm(lockPath, { force: true })
    }
  })
  const observed = operation.catch(() => {})
  pendingWrites.set(realRoot, observed)
  try {
    return await operation
  }
  finally {
    if (pendingWrites.get(realRoot) === observed)
      pendingWrites.delete(realRoot)
  }
}
