import type { IFileSystem } from './types'

export interface StudioFileMutation { path: string, revision: number, pending: number, external?: boolean }
interface State { revision: number, flushed: number, pending: number, listeners: Set<(event: StudioFileMutation) => void>, waiters: Set<() => void>, unsubscribeExternal?: () => void, external?: () => void }
const states = new WeakMap<IFileSystem, State>()
const methods = ['writeFile', 'writeBlob', 'mkdir', 'deleteFile', 'rmdir'] as const

function state(fs: IFileSystem): State {
  observeStudioFileSystem(fs)
  return states.get(fs)!
}

/** Observe the shared adapter in place, preserving identity, native handles and write locks. */
export function observeStudioFileSystem(fs: IFileSystem): IFileSystem {
  if (states.has(fs))
    return fs
  const current: State = { revision: 0, flushed: 0, pending: 0, listeners: new Set(), waiters: new Set() }
  states.set(fs, current)
  function notify(path: string, external = false) {
    current.revision += 1
    const event = { path: typeof path === 'string' ? path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/') : '', revision: current.revision, pending: current.pending, ...(external ? { external: true } : {}) }
    for (const listener of current.listeners) {
      // Observations cannot turn a successful file operation into a write failure.
      try {
        listener(event)
      }
      catch {}
    }
    if (!current.pending) {
      for (const done of current.waiters)
        done()
      current.waiters.clear()
    }
  }
  current.external = () => {
    const clean = current.revision === current.flushed && !current.pending
    const revision = current.revision + 1
    notify('adv', true)
    // A remote hint is not a local draft. Preserve dirty local writes, including
    // any write a listener starts synchronously while processing this hint.
    if (clean && current.revision === revision && !current.pending)
      current.flushed = revision
  }
  for (const method of methods) {
    if (typeof fs[method] !== 'function')
      continue
    const original = fs[method].bind(fs) as (path: string, ...args: unknown[]) => Promise<void>
    Object.assign(fs, { [method]: async (path: string, ...args: unknown[]) => {
      current.pending += 1
      notify(path)
      try {
        await original(path, ...args)
      }
      finally {
        current.pending -= 1
        notify(path)
      }
    } })
  }
  if (fs.transaction) {
    const original = fs.transaction.bind(fs)
    fs.transaction = async (operation, validate) => {
      current.pending += 1
      notify('adv')
      let committed = false
      try {
        await original(operation, validate)
        committed = true
      }
      finally {
        current.pending -= 1
        const revision = current.revision + 1
        notify('adv')
        if (committed && current.revision === revision && !current.pending)
          current.flushed = revision
      }
    }
  }
  if (fs.flush) {
    const original = fs.flush.bind(fs)
    fs.flush = async () => {
      const revision = current.revision
      await original()
      if (revision === current.revision)
        current.flushed = revision
    }
  }
  return fs
}

/** Initial reads and already durable transactions must remain free of storage writes. */
export async function flushStudioFileMutations(fs: IFileSystem): Promise<void> {
  const current = state(fs)
  if (current.revision !== current.flushed)
    await fs.flush?.()
}

export function subscribeStudioFileMutations(fs: IFileSystem, listener: (event: StudioFileMutation) => void): () => void {
  const current = state(fs)
  current.listeners.add(listener)
  if (current.listeners.size === 1 && !current.unsubscribeExternal) {
    try {
      current.unsubscribeExternal = fs.subscribeExternalChanges?.(current.external!)
    }
    catch {}
  }
  return () => {
    current.listeners.delete(listener)
    if (!current.listeners.size) {
      try {
        current.unsubscribeExternal?.()
      }
      catch {}
      current.unsubscribeExternal = undefined
    }
  }
}

export function studioFileMutationRevision(fs: IFileSystem): number {
  return state(fs).revision
}

/** A journal decision changes source readiness even when no project bytes changed. */
export function notifyStudioFileSystemRefresh(fs: IFileSystem) {
  state(fs).external?.()
}

export async function whenStudioFileMutationsSettle(fs: IFileSystem): Promise<void> {
  const current = state(fs)
  while (current.pending)
    await new Promise<void>(resolve => current.waiters.add(resolve))
}
