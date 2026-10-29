import type { IFileSystem } from '../utils/fs'
import { describe, expect, it, vi } from 'vitest'
import { runStudioProjectWrite, setStudioProjectReadinessCheck, setStudioProjectWriteBarrier, whenStudioProjectWritesSettle } from '../utils/projectWriteQueue'

function gate() {
  let release!: () => void
  const promise = new Promise<void>(resolve => release = resolve)
  return { promise, release }
}

describe('project readiness at queued operation boundaries', () => {
  it('rejects an ordinary write when the durable check discovers another window recovery', async () => {
    const fs = {} as IFileSystem
    const write = vi.fn(async () => {})
    setStudioProjectReadinessCheck(fs, async () => setStudioProjectWriteBarrier(fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED'))
    await expect(runStudioProjectWrite(fs, write)).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    expect(write).not.toHaveBeenCalled()
  })

  it('rechecks a cached barrier and permits an explicit later write after recovery cleared', async () => {
    const fs = {} as IFileSystem
    setStudioProjectWriteBarrier(fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    setStudioProjectReadinessCheck(fs, async () => setStudioProjectWriteBarrier(fs))
    await expect(runStudioProjectWrite(fs, async () => 'saved')).resolves.toBe('saved')
  })

  it('checks after the earlier operation finishes, including its late recovery state', async () => {
    const fs = {} as IFileSystem
    const waiting = gate()
    let blocked = false
    setStudioProjectReadinessCheck(fs, async () => setStudioProjectWriteBarrier(fs, blocked ? 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED' : undefined))
    const earlier = runStudioProjectWrite(fs, async () => {
      await waiting.promise
      blocked = true
    })
    const write = vi.fn(async () => {})
    const later = expect(runStudioProjectWrite(fs, write)).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    waiting.release()
    await earlier
    await later
    expect(write).not.toHaveBeenCalled()
  })

  it('keeps a read waiting for a new write queued during its asynchronous readiness check', async () => {
    const fs = {} as IFileSystem
    const checking = gate()
    const writing = gate()
    let first = true
    setStudioProjectReadinessCheck(fs, async () => {
      if (first) {
        first = false
        await checking.promise
      }
    })
    let readFinished = false
    const read = whenStudioProjectWritesSettle(fs).then(() => readFinished = true)
    await Promise.resolve()
    const write = runStudioProjectWrite(fs, () => writing.promise)
    checking.release()
    await vi.waitFor(() => expect(first).toBe(false))
    expect(readFinished).toBe(false)
    writing.release()
    await write
    await read
    expect(readFinished).toBe(true)
  })

  it('allows explicit recovery while unknown storage still blocks ordinary reads and writes', async () => {
    const fs = {} as IFileSystem
    setStudioProjectReadinessCheck(fs, async () => {
      setStudioProjectWriteBarrier(fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_UNKNOWN')
      throw new Error('Storage unavailable')
    })
    await expect(runStudioProjectWrite(fs, async () => 'reviewed', { recovery: true })).resolves.toBe('reviewed')
    await expect(whenStudioProjectWritesSettle(fs)).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_UNKNOWN')
    await expect(runStudioProjectWrite(fs, async () => 'unsafe')).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_UNKNOWN')
  })

  it('rechecks durable readiness after acquiring another instance coordination lock', async () => {
    const waiting = gate()
    const coordinate = vi.fn(async <T>(operation: () => Promise<T>) => {
      await waiting.promise
      return operation()
    })
    const fs = { withWriteLock: coordinate } as unknown as IFileSystem
    let blocked = false
    const check = vi.fn(async () => setStudioProjectWriteBarrier(fs, blocked ? 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED' : undefined))
    setStudioProjectReadinessCheck(fs, check)
    const write = vi.fn(async () => 'saved')
    const result = expect(runStudioProjectWrite(fs, write)).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    await vi.waitFor(() => expect(coordinate).toHaveBeenCalledOnce())
    expect(check).not.toHaveBeenCalled()
    blocked = true
    waiting.release()
    await result
    expect(write).not.toHaveBeenCalled()
  })

  it('explicit recovery also waits for an active native peer operation', async () => {
    const waiting = gate()
    const coordinate = vi.fn(async <T>(operation: () => Promise<T>) => {
      await waiting.promise
      return operation()
    })
    const fs = { withWriteLock: coordinate } as unknown as IFileSystem
    setStudioProjectWriteBarrier(fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    const restore = vi.fn(async () => 'restored')
    const result = runStudioProjectWrite(fs, restore, { recovery: true })
    await vi.waitFor(() => expect(coordinate).toHaveBeenCalledOnce())
    expect(restore).not.toHaveBeenCalled()
    waiting.release()
    await expect(result).resolves.toBe('restored')
  })

  it('saved-source readiness cannot finish while a coordinated peer is active', async () => {
    const waiting = gate()
    const coordinate = vi.fn(async <T>(operation: () => Promise<T>) => {
      await waiting.promise
      return operation()
    })
    const fs = { withWriteLock: coordinate } as unknown as IFileSystem
    let finished = false
    const result = whenStudioProjectWritesSettle(fs).then(() => {
      finished = true
    })
    await vi.waitFor(() => expect(coordinate).toHaveBeenCalledOnce())
    expect(finished).toBe(false)
    waiting.release()
    await result
    expect(finished).toBe(true)
  })

  it('a rejected coordination request performs no I/O and does not poison a later explicit save', async () => {
    let available = false
    const fs = { withWriteLock: async <T>(operation: () => Promise<T>) => {
      if (!available)
        throw new Error('Coordination unavailable')
      return operation()
    } } as IFileSystem
    const write = vi.fn(async () => 'saved')
    await expect(runStudioProjectWrite(fs, write)).rejects.toThrow('Coordination unavailable')
    expect(write).not.toHaveBeenCalled()
    available = true
    await expect(runStudioProjectWrite(fs, write)).resolves.toBe('saved')
    expect(write).toHaveBeenCalledOnce()
  })
})
