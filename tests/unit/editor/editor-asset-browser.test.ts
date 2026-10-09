import type { App } from 'vue'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, ref } from 'vue'
import ProjectAssetList from '../../../editor/core/app/components/project/ProjectAssetList.vue'
import ProjectFileTree from '../../../editor/core/app/components/project/ProjectFileTree.vue'
import { useAssetBrowserStore } from '../../../editor/core/app/stores/useAssetBrowserStore'
import { ASSET_BROWSER_STATE_KEY, assetDirectoryTree, restoreAssetBrowserPreferences } from '../../../editor/core/app/utils/asset-browser'

const paths = ['adv/chapters/story.adv.md', 'adv/assets/bg/map.svg', 'adv/assets/bg/nested/room.webp', 'adv/assets/bg2/hero.png', 'adv/assets/audio/theme.ogg']
let pinia: ReturnType<typeof createPinia>
let project: { localFilePaths: string[], workspace: object, project: object | undefined }
let app: App | undefined
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  project = reactive({ localFilePaths: [...paths], workspace: {}, project: {} })
  vi.stubGlobal('useProjectStore', () => project)
})
afterEach(() => {
  app?.unmount()
  app = undefined
  disposePinia(pinia)
  localStorage.clear()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
function mount(render: () => ReturnType<typeof h>) {
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({ setup: () => render })
  app.mount(root)
  return root
}

describe('asset browser navigation', () => {
  it('filters within a directory boundary, includes descendants and can search the whole project', () => {
    const browser = useAssetBrowserStore()
    browser.browse('adv/assets/bg')
    expect(browser.filtered).toEqual(['adv/assets/bg/map.svg', 'adv/assets/bg/nested/room.webp'])
    browser.query = 'HERO'
    expect(browser.filtered).toEqual([])
    browser.preferences.scope = 'all'
    expect(browser.filtered).toEqual(['adv/assets/bg2/hero.png'])
    browser.query = ''
    browser.type = 'audio'
    expect(browser.filtered).toEqual(['adv/assets/audio/theme.ogg'])
    expect(assetDirectoryTree(browser.paths, new Set()).map(node => node.name)).toEqual(['adv'])
  })

  it('reveals an asset without opening it and cancels stale filters while retaining separate project selection', () => {
    const browser = useAssetBrowserStore()
    browser.query = 'missing'
    browser.type = 'audio'
    browser.revealInProject('adv/chapters/story.adv.md')
    browser.revealAsset('adv/assets/bg2/hero.png')
    expect(browser.preferences.folder).toBe('adv/assets/bg2')
    expect(browser.filtered).toEqual(['adv/assets/bg2/hero.png'])
    expect(browser.selectedPath).toBe('adv/assets/bg2/hero.png')
    expect(browser.projectRevealPath).toBe('adv/chapters/story.adv.md')
  })

  it('persists browsing preferences and recovers to a surviving ancestor after a directory disappears', async () => {
    const browser = useAssetBrowserStore()
    browser.browse('adv/assets/bg/nested')
    browser.preferences.mode = 'list'
    browser.preferences.sidebarWidth = 220
    browser.preferences.sidebarVisible = false
    browser.selectedPath = 'adv/assets/bg/nested/room.webp'
    await nextTick()
    expect(JSON.parse(localStorage.getItem(ASSET_BROWSER_STATE_KEY)!)).toMatchObject({ folder: 'adv/assets/bg/nested', mode: 'list', sidebarWidth: 220, sidebarVisible: false })
    project.localFilePaths = paths.filter(path => !path.includes('/nested/'))
    await nextTick()
    expect(browser.preferences.folder).toBe('adv/assets/bg')
    expect(browser.selectedPath).toBe('')
    project.workspace = {}
    expect(browser.selectedPath).toBe('')
    expect(browser.preferences.mode).toBe('list')
    expect(restoreAssetBrowserPreferences({ sidebarWidth: -200, mode: 'bogus', scope: null })).toMatchObject({ sidebarWidth: 140, mode: 'grid', scope: 'folder' })
  })

  it('restores a saved folder once the project finishes loading', async () => {
    localStorage.setItem(ASSET_BROWSER_STATE_KEY, JSON.stringify({ folder: 'adv/assets/bg', sidebarWidth: 210 }))
    project.localFilePaths = []
    project.project = undefined
    const browser = useAssetBrowserStore()
    expect(browser.preferences.folder).toBe('adv/assets/bg')
    project.localFilePaths = [...paths]
    project.project = {}
    await nextTick()
    expect(browser.filtered).toEqual(['adv/assets/bg/map.svg', 'adv/assets/bg/nested/room.webp'])
  })
})

describe('asset selection and cross-view focus', () => {
  it('selects with a single click, opens with double click or Enter and keeps one keyboard tab stop', async () => {
    const selected = ref('')
    const open = vi.fn()
    const visible = ref(['adv/assets/bg/map.svg', 'adv/assets/bg2/hero.png'])
    const root = mount(() => h(ProjectAssetList, { paths: visible.value, selected: selected.value, visible: false, mode: 'list', label: 'Assets', onSelect: path => selected.value = path, onOpen: open }))
    const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('button')]
    buttons()[0].click()
    await nextTick()
    expect(selected.value).toBe(visible.value[0])
    expect(open).not.toHaveBeenCalled()
    buttons()[0].focus()
    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(buttons()[1])
    expect(selected.value).toBe(visible.value[1])
    expect(buttons().map(button => button.tabIndex)).toEqual([-1, 0])
    buttons()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(open).toHaveBeenCalledTimes(1)
    buttons()[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(open).toHaveBeenCalledTimes(2)
    visible.value = [visible.value[0]]
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(buttons()[0])
  })

  it('expands ancestors and focuses a revealed project file without activating or opening it', async () => {
    const scroll = vi.fn()
    const original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scroll
    try {
      const selected = ref('')
      const version = ref(0)
      const open = vi.fn()
      const root = mount(() => h(ProjectFileTree, { paths, selected: selected.value, query: '', label: 'Project', revealVersion: version.value, onOpen: open }))
      selected.value = 'adv/assets/bg/nested/room.webp'
      version.value++
      await nextTick()
      await nextTick()
      const row = root.querySelector<HTMLElement>('[aria-selected="true"]')!
      expect(row.textContent).toContain('room.webp')
      expect(document.activeElement).toBe(row)
      expect(scroll).toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    }
    finally { HTMLElement.prototype.scrollIntoView = original }
  })
})
