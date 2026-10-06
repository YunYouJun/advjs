import { describe, expect, it, vi } from 'vitest'
import { createEditorStartup } from '../../editor/core/app/startup'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('editor startup', () => {
  it('waits for each real task and reaches ready only after the project has loaded', async () => {
    const preferences = deferred()
    const extensions = deferred()
    const workspace = deferred()
    const steps = [
      { id: 'preferences' as const, run: vi.fn(() => preferences.promise) },
      { id: 'extensions' as const, run: vi.fn(() => extensions.promise) },
      { id: 'workspace' as const, run: vi.fn(() => workspace.promise) },
    ]
    const startup = createEditorStartup(steps)
    const pending = startup.start()
    expect(startup.start()).toBe(pending)
    expect(startup.state.value).toMatchObject({ phase: 'preferences', completed: 0, progress: 0 })
    expect(steps[1].run).not.toHaveBeenCalled()
    preferences.resolve()
    await vi.waitFor(() => expect(steps[1].run).toHaveBeenCalledOnce())
    expect(startup.state.value).toMatchObject({ phase: 'extensions', completed: 1, progress: 33 })
    extensions.resolve()
    await vi.waitFor(() => expect(steps[2].run).toHaveBeenCalledOnce())
    expect(startup.state.value).toMatchObject({ status: 'loading', phase: 'workspace', completed: 2, progress: 67 })
    // A long-running project task cannot finish by elapsed time.
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(60_000)
    vi.useRealTimers()
    expect(startup.state.value.status).toBe('loading')
    workspace.resolve()
    await pending
    expect(startup.state.value).toMatchObject({ status: 'ready', phase: 'ready', completed: 3, progress: 100, error: '' })
    await startup.start()
    expect(steps[2].run).toHaveBeenCalledOnce()
  })

  it.each(['preferences', 'extensions', 'workspace'] as const)('reports %s failure and retries from that task', async (failed) => {
    let failure = true
    const ids = ['preferences', 'extensions', 'workspace'] as const
    const steps = ids.map(id => ({ id, run: vi.fn(async () => {
      if (id === failed && failure)
        throw new Error('Unavailable')
    }) }))
    const startup = createEditorStartup(steps)
    await startup.start()
    const index = ids.indexOf(failed)
    expect(startup.state.value).toMatchObject({ status: 'error', phase: failed, completed: index, error: 'Unavailable' })
    expect(startup.state.value.progress).toBeLessThan(100)
    for (const step of steps.slice(index + 1)) expect(step.run).not.toHaveBeenCalled()
    failure = false
    await startup.start()
    expect(startup.state.value).toMatchObject({ status: 'ready', completed: 3, error: '' })
    for (const step of steps) expect(step.run).toHaveBeenCalledTimes(step.id === failed ? 2 : 1)
  })

  it.each([false, true])('ignores late completion or failure after disposal (reject=%s)', async (reject) => {
    const pending = deferred()
    const next = vi.fn(async () => {})
    const startup = createEditorStartup([{ id: 'preferences', run: () => pending.promise }, { id: 'workspace', run: next }])
    const running = startup.start()
    const previous = startup.state.value
    startup.dispose()
    reject ? pending.reject(new Error('late')) : pending.resolve()
    await running
    await startup.start()
    expect(startup.state.value).toBe(previous)
    expect(next).not.toHaveBeenCalled()
  })
})
