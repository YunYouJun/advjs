import type { App } from 'vue'
import type { FSItem } from '../../../packages/gui/client/components/explorer/types'
import type { AGUIAssetsExplorerState } from '../../../packages/gui/client/composables/useAssetsExplorer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, provide, ref } from 'vue'
import AGUIAssetsExplorer from '../../../packages/gui/client/components/explorer/AGUIAssetsExplorer.vue'
import AGUIFileList from '../../../packages/gui/client/components/explorer/AGUIFileList.vue'
import AGUITree from '../../../packages/gui/client/components/tree/AGUITree.vue'
import { AGUIAssetsExplorerSymbol } from '../../../packages/gui/client/composables/useAssetsExplorer'
import { useExplorerKeyboard } from '../../../packages/gui/client/composables/useExplorerKeyboard'
import { useFileOperations } from '../../../packages/gui/client/composables/useFileOperations'
import { useFileSelection } from '../../../packages/gui/client/composables/useFileSelection'

import { mockResizeObserver } from '../../helpers/resize-observer'

beforeEach(mockResizeObserver)

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})
function mount(render: () => ReturnType<typeof h>, setup?: () => void) {
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({
    setup() {
      setup?.()
      return render
    },
  })
  app.mount(container)
  return container
}
async function key(element: Element, value: string, options: KeyboardEventInit = {}) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }))
  await nextTick()
}

describe('aGUI tree navigation', () => {
  it.each([false, true])('navigates hierarchy with one tab stop and activates with context menus: %s', async (withMenu) => {
    const child = { name: 'Chapter one' }
    const root = ref([{ name: 'Story', expanded: false, children: [child] }, { name: 'Assets' }])
    const activate = vi.fn()
    const open = vi.fn()
    const container = mount(() => h(AGUITree, { 'data': root.value, 'label': 'Project', 'contextMenu': withMenu ? () => [{ label: 'Open', onClick: vi.fn() }] : undefined, 'onNode-activate': activate, 'onNode-dblclick': open }))
    const rows = () => [...container.querySelectorAll<HTMLElement>('[role=treeitem]')]
    expect(container.querySelector('[role=tree]')!.getAttribute('aria-label')).toBe('Project')
    expect(rows().map(row => row.tabIndex)).toEqual([0, -1])
    rows()[0].focus()
    await key(rows()[0], 'ArrowRight')
    expect(rows()[0].getAttribute('aria-expanded')).toBe('true')
    expect(rows()).toHaveLength(3)
    await key(rows()[0], 'ArrowRight')
    expect(document.activeElement).toBe(rows()[1])
    expect(rows()[1].hasAttribute('aria-expanded')).toBe(false)
    expect(activate).not.toHaveBeenCalled()
    await key(rows()[1], 'Enter')
    expect(activate).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(1)
    expect(rows()[1].getAttribute('aria-selected')).toBe('true')
    await key(rows()[1], 'ArrowLeft')
    expect(document.activeElement).toBe(rows()[0])
    await key(rows()[0], 'ArrowLeft')
    expect(rows()).toHaveLength(2)
    await key(rows()[0], 'End')
    expect(document.activeElement).toBe(rows()[1])
    await key(rows()[1], 'Home')
    expect(document.activeElement).toBe(rows()[0])
    expect(rows().filter(row => row.tabIndex === 0)).toHaveLength(1)
  })

  it('cancels delayed disclosure when unmounted and keeps row tools independent', async () => {
    vi.useFakeTimers()
    const root = ref({ name: 'Scene', visible: true, expanded: false, children: [{ name: 'Child' }] })
    const activate = vi.fn()
    const expand = vi.fn()
    const container = mount(() => h(AGUITree, { 'data': root.value, 'onNode-activate': activate, 'onNode-expand': expand }))
    const buttons = container.querySelectorAll('button')
    buttons[1].click()
    await nextTick()
    expect(root.value.visible).toBe(false)
    expect(activate).not.toHaveBeenCalled()
    expect(buttons[1].type).toBe('button')
    buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    app!.unmount()
    app = undefined
    vi.runAllTimers()
    expect(expand).not.toHaveBeenCalled()
  })
})

function file(name: string): FSItem {
  return { name, kind: 'file', icon: 'i-ri-file-line', handle: { name, kind: 'file' } as FileSystemFileHandle }
}
function mountFiles() {
  const items = ref([file('a.adv.md'), file('b.adv.md'), file('c.adv.md')])
  const visible = ref(items.value)
  const containerRef = ref<HTMLElement>()
  const selection = useFileSelection()
  const open = vi.fn()
  const state: AGUIAssetsExplorerState = {
    rootDir: ref(),
    curDir: ref(),
    curFileList: items,
    tree: ref({}),
    selection,
    emit: vi.fn(),
    setCurDir: vi.fn(),
    setCurFileList: vi.fn(),
    setRootDir: vi.fn(),
    refreshCurrentDir: vi.fn(),
    onFileDblClick: open,
  }
  const container = mount(() => h('div', { ref: containerRef }, [h(AGUIFileList, { list: visible.value, size: 16 }), h('button', 'Tools')]), () => {
    provide(AGUIAssetsExplorerSymbol, state)
    useExplorerKeyboard(state, useFileOperations(state), containerRef, visible)
  })
  return { container, selection, items, visible, open }
}

describe('aGUI file navigation', () => {
  it('keeps selection when opening tools and supports range and modifier navigation', async () => {
    const { container, selection } = mountFiles()
    const items = [...container.querySelectorAll<HTMLElement>('[role=option]')]
    items[0].click()
    await nextTick()
    expect(document.activeElement).toBe(items[0])
    await key(items[0], 'ArrowDown', { shiftKey: true })
    expect(selection.selectedItems.size).toBe(2)
    expect(document.activeElement).toBe(items[1])
    await key(items[1], 'ArrowDown', { shiftKey: true })
    expect(selection.selectedItems.size).toBe(3)
    await key(items[2], 'ArrowUp', { ctrlKey: true })
    expect(selection.selectedItems.size).toBe(3)
    await key(items[1], 'ArrowDown', { ctrlKey: true })
    expect(selection.selectedItems.size).toBe(3)
    expect(document.activeElement).toBe(items[2])
    container.querySelector('button')!.focus()
    await nextTick()
    expect(selection.selectedItems.size).toBe(3)
    expect(items.filter(item => item.tabIndex === 0)).toHaveLength(1)
  })

  it('opens focused files, limits select-all to visible files, and cancels rename with focus restored', async () => {
    const { container, selection, items, visible, open } = mountFiles()
    visible.value = [items.value[1]]
    await nextTick()
    const item = container.querySelector<HTMLElement>('[role=option]')!
    item.focus()
    await key(item, 'a', { ctrlKey: true })
    expect([...selection.selectedItems]).toEqual([items.value[1]])
    await key(item, 'Enter')
    expect(open).toHaveBeenCalledWith(items.value[1])
    await key(item, 'F2')
    await nextTick()
    const input = container.querySelector('input')!
    expect(document.activeElement).toBe(input)
    input.value = 'changed.adv.md'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await key(input, 'Escape')
    expect(selection.renamingItem.value).toBeUndefined()
    expect(items.value[1].name).toBe('b.adv.md')
    expect(document.activeElement).toBe(item)
    expect(selection.selectedItems.size).toBe(1)
  })
})

describe('aGUI explorer filtering', () => {
  it('filters current-folder names, resets selection, and exposes an empty state', async () => {
    const explorer = ref<InstanceType<typeof AGUIAssetsExplorer>>()
    const container = mount(() => h(AGUIAssetsExplorer, { ref: explorer }))
    await nextTick()
    explorer.value!.setCurFileList([file('Chapter-01.adv.md'), file('world-notes.md')])
    await nextTick()
    const first = container.querySelector<HTMLElement>('[role=option]')!
    first.click()
    await key(first, 'F2')
    await nextTick()
    const rename = container.querySelector<HTMLInputElement>('[aria-label="Rename Chapter-01.adv.md"]')!
    expect(rename).not.toBeNull()
    await key(rename, 'Escape')
    const search = container.querySelector<HTMLInputElement>('[aria-label="Filter current folder"]')!
    search.value = 'CHAPTER'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(container.querySelectorAll('[role=option]')).toHaveLength(1)
    expect(container.querySelector('[role=option]')!.getAttribute('aria-selected')).toBe('false')
    expect(container.querySelector('[role=option]')!.textContent).toContain('Chapter-01.adv.md')
    search.value = 'missing'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(container.querySelectorAll('[role=option]')).toHaveLength(0)
    expect(container.querySelector('[role=status]')!.textContent).toContain('No files')
  })
})
