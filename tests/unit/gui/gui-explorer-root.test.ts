import type { FSDirItem } from '../../../packages/gui/client/components/explorer/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import AGUIAssetsExplorer from '../../../packages/gui/client/components/explorer/AGUIAssetsExplorer.vue'

import { mockResizeObserver } from '../../helpers/resize-observer'

beforeEach(mockResizeObserver)

let cleanup: (() => void) | undefined
afterEach(() => {
  cleanup?.()
  cleanup = undefined
  document.body.innerHTML = ''
})

function directory(name: string): FSDirItem {
  return {
    name,
    kind: 'directory',
    handle: {
      kind: 'directory',
      name,
      values: vi.fn(async function* () {}),
    } as unknown as FileSystemDirectoryHandle,
  }
}

function mount(initial?: FSDirItem) {
  const root = shallowRef(initial)
  const updates = vi.fn((value: FSDirItem) => {
    root.value = value
  })
  const app = createApp(defineComponent({
    setup: () => () => h(AGUIAssetsExplorer, { 'rootDir': root.value, 'onUpdate:rootDir': updates }),
  }))
  const container = document.createElement('div')
  document.body.append(container)
  app.mount(container)
  cleanup = () => app.unmount()
  return { root, updates, container }
}

describe('explorer workspace restoration', () => {
  it('populates a project that was restored before the panel mounted', async () => {
    const initial = directory('restored-story')
    const { updates, container } = mount(initial)
    await vi.waitFor(() => expect(container.textContent).toContain('restored-story'))
    await nextTick()
    expect(initial.handle.values).toHaveBeenCalledTimes(1)
    expect(updates).toHaveBeenCalledTimes(1)
  })

  it('accepts an external project switch without reopening its v-model echo', async () => {
    const { root, updates, container } = mount()
    const first = directory('first-story')
    root.value = first
    await vi.waitFor(() => expect(container.textContent).toContain('first-story'))
    await nextTick()
    expect(first.handle.values).toHaveBeenCalledTimes(1)
    expect(updates).toHaveBeenCalledTimes(1)

    const second = directory('second-story')
    root.value = second
    await vi.waitFor(() => expect(container.textContent).toContain('second-story'))
    await nextTick()
    expect(second.handle.values).toHaveBeenCalledTimes(1)
    expect(updates).toHaveBeenCalledTimes(2)
    root.value = undefined
    await nextTick()
    expect(container.textContent).not.toContain('second-story')
  })
})
