import type { GraphNode } from '@vue-flow/core'
import { consola } from 'consola'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useFlowLayout } from '../../../editor/core/app/composables/flow/useFlowLayout'
import { usePreviewFileChanges } from '../../../editor/core/app/composables/usePreviewFileChanges'
import { proxyLog } from '../../../editor/core/app/utils/log'

const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function directory(files: Map<string, number>) {
  const read = vi.fn(async (name: string) => ({ lastModified: files.get(name)! }))
  const chapters = {
    async* values() {
      for (const name of files.keys())
        yield { kind: 'file', name, getFile: () => read(name) }
    },
  }
  const root = {
    getDirectoryHandle: vi.fn(async (name: string) => {
      if (name === 'chapters')
        return chapters
      throw new DOMException('Directory not found', 'NotFoundError')
    }),
    getFileHandle: vi.fn(async () => { throw new DOMException('No legacy index', 'NotFoundError') }),
  } as unknown as FileSystemDirectoryHandle
  return { root, read }
}

async function flushScan() {
  // A scan awaits directory, optional index and chapter handles in sequence.
  for (let i = 0; i < 12; i++)
    await nextTick()
}

function preview(root: FileSystemDirectoryHandle) {
  const visible = shallowRef(true)
  const current = shallowRef<FileSystemDirectoryHandle | undefined>(root)
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => usePreviewFileChanges({ visible: () => visible.value, directory: () => current.value }))!
  return { ...state, visible, current, scope }
}

describe('retained browser preview polling', () => {
  it('detects chapter creation from an empty project, edits at timestamp zero, and deletion', async () => {
    const files = new Map<string, number>()
    const state = preview(directory(files).root)
    await flushScan()
    files.set('intro.adv.md', 0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(true)
    state.hasFileChanges.value = false
    files.set('intro.adv.md', 1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(true)
    state.hasFileChanges.value = false
    files.delete('intro.adv.md')
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(true)
  })

  it('pauses hidden views and checks changes immediately on return without losing the baseline', async () => {
    const files = new Map([['intro.adv.md', 1]])
    const { root, read } = directory(files)
    const state = preview(root)
    await flushScan()
    expect(read).toHaveBeenCalledTimes(1)
    state.visible.value = false
    files.set('intro.adv.md', 2)
    await vi.advanceTimersByTimeAsync(15000)
    expect(read).toHaveBeenCalledTimes(1)
    expect(state.hasFileChanges.value).toBe(false)
    state.visible.value = true
    await flushScan()
    expect(state.hasFileChanges.value).toBe(true)
    state.scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores an in-flight hidden scan and prevents overlapping directory reads', async () => {
    const files = new Map([['intro.adv.md', 1]])
    const { root, read } = directory(files)
    const state = preview(root)
    await flushScan()
    let finish!: (file: { lastModified: number }) => void
    read.mockImplementationOnce(() => new Promise(resolve => finish = resolve))
    await vi.advanceTimersByTimeAsync(15000)
    expect(read).toHaveBeenCalledTimes(2)
    state.visible.value = false
    finish({ lastModified: 2 })
    await flushScan()
    expect(state.hasFileChanges.value).toBe(false)
    state.visible.value = true
    files.set('intro.adv.md', 2)
    await flushScan()
    expect(state.hasFileChanges.value).toBe(true)
  })

  it('discards late results from the previous workspace and resets closed-project state', async () => {
    const { root, read } = directory(new Map([['old.adv.md', 1]]))
    let finish!: (file: { lastModified: number }) => void
    read.mockImplementationOnce(() => new Promise(resolve => finish = resolve))
    const state = preview(root)
    await flushScan()
    const files = new Map([['new.adv.md', 10]])
    state.current.value = directory(files).root
    await flushScan()
    finish({ lastModified: 2 })
    await flushScan()
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(false)
    files.set('new.adv.md', 11)
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(true)
    state.current.value = undefined
    expect(state.hasFileChanges.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains its baseline after a failed scan and ignores results after disposal', async () => {
    const { root, read } = directory(new Map([['intro.adv.md', 1]]))
    const state = preview(root)
    await flushScan()
    read.mockRejectedValueOnce(new Error('Permission temporarily unavailable'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(false)
    read.mockResolvedValueOnce({ lastModified: 2 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(true)
    state.hasFileChanges.value = false
    let finish!: (file: { lastModified: number }) => void
    read.mockImplementationOnce(() => new Promise(resolve => finish = resolve))
    await vi.advanceTimersByTimeAsync(5000)
    state.scope.stop()
    finish({ lastModified: 3 })
    await flushScan()
    expect(state.hasFileChanges.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not interpret directory permission failures as removed files', async () => {
    const files = new Map([['intro.adv.md', 1]])
    const { root } = directory(files)
    const state = preview(root)
    await flushScan()
    vi.mocked(root.getDirectoryHandle).mockRejectedValueOnce(new DOMException('Access revoked', 'NotAllowedError'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(false)
    files.set('intro.adv.md', 2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.hasFileChanges.value).toBe(true)
  })
})

describe('retained preview log subscriptions', () => {
  it('does not duplicate logs after remount and releases the reporter and global level', () => {
    const store = { info: vi.fn(), debug: vi.fn() }
    vi.stubGlobal('useConsoleStore', () => store)
    const originalInfo = consola.info
    const originalDebug = consola.debug
    const originalLevel = consola.level
    for (let i = 0; i < 3; i++) {
      const scope = effectScope()
      scopes.push(scope)
      scope.run(proxyLog)
      consola.info(`Preview ${i}`, { i })
      expect(store.info).toHaveBeenCalledTimes(i + 1)
      expect(store.info).toHaveBeenLastCalledWith(`Preview ${i}`, { i })
      consola.debug(`Debug ${i}`)
      expect(store.debug).toHaveBeenCalledTimes(i + 1)
      scope.stop()
      consola.info(`Unmounted ${i}`)
      expect(store.info).toHaveBeenCalledTimes(i + 1)
    }
    expect(consola.info).toBe(originalInfo)
    expect(consola.debug).toBe(originalDebug)
    expect(consola.level).toBe(originalLevel)
  })
})

describe('flow layout data', () => {
  it('uses the current view dimensions and falls back for unmounted nodes without a renderer', () => {
    const { layout } = useFlowLayout()
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, data: {} }, { id: 'b', position: { x: 0, y: 0 }, data: {} }]
    const edges = [{ id: 'a-b', source: 'a', target: 'b' }]
    const findNode = vi.fn((id: string) => id === 'a' ? { dimensions: { width: 300, height: 100 } } as GraphNode : undefined)
    const horizontal = layout(nodes, edges, 'LR', findNode)
    expect(findNode.mock.calls).toEqual([['a'], ['b']])
    expect(horizontal[1].position.x).toBeGreaterThan(horizontal[0].position.x)
    // Dagre returns centers; Vue Flow positions are top-left coordinates.
    // Unequal node heights still align at their centers without shifting edges.
    expect(horizontal[0].position.y + 100 / 2).toBe(horizontal[1].position.y + 50 / 2)
    expect(horizontal[1].position.x - horizontal[0].position.x).toBeGreaterThanOrEqual(300)
    const vertical = layout(nodes, edges, 'TB')
    expect(vertical[1].position.y).toBeGreaterThan(vertical[0].position.y)
    expect(nodes.map(node => node.position)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }])
  })
})
