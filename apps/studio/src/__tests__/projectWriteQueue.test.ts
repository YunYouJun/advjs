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
})
