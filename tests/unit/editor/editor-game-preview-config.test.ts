import type { AdvGameConfig } from '@advjs/types'
import type { AdvContext } from '../../../packages/client/types'
import { advDataRef } from '@advjs/client/compiler'
import { acceptHMRUpdate, createPinia, defineStore, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { useGameStore } from '../../../editor/core/app/stores/useGameStore'
import { defaultAdvConfig, defaultGameConfig } from '../../../packages/advjs/shared/config'

let context: AdvContext
let client: { loadStatus: number }
vi.mock('@advjs/client', () => ({
  AdvGameLoadStatusEnum: { FAIL: -1, CONFIG_LOADED: 1, SUCCESS: 2 },
  useAdvContext: () => ({ $adv: context }),
  useGameStore: () => client,
}))
vi.mock('@advjs/client/compiler', async () => {
  const { shallowRef } = await import('vue')
  return { advDataRef: shallowRef({ config: {}, gameConfig: {} }) }
})
vi.mock('@advjs/gui', () => ({ Toast: vi.fn() }))
vi.mock('advjs', async () => ({ defaultAdvConfig: (await import('../../../packages/advjs/shared/config')).defaultAdvConfig }))
vi.mock('../../../editor/core/app/workspaces/browser-session', () => ({
  createBrowserSessionStorage: () => ({ load: async () => ({ projects: [] }), save: async () => {} }),
}))

let pinia: ReturnType<typeof createPinia>
let project: ReturnType<typeof import('../../../editor/core/app/stores/useProjectStore')['useProjectStore']>
let game: ReturnType<typeof useGameStore>
let initialized: Array<{ avatar: boolean | undefined, viewportFit: string | undefined, title: string }>

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  client = { loadStatus: 0 }
  initialized = []
  advDataRef.value = { ...advDataRef.value, config: structuredClone(defaultAdvConfig), gameConfig: structuredClone(defaultGameConfig) }
  context = {
    config: computed(() => advDataRef.value.config),
    gameConfig: computed(() => advDataRef.value.gameConfig),
    init: vi.fn(async () => {
      initialized.push({ avatar: context.config.value.showCharacterAvatar, viewportFit: context.config.value.viewportFit, title: context.gameConfig.value.title })
    }),
    runtime: { start: vi.fn(async () => {}) },
  } as unknown as AdvContext
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('defineStore', defineStore)
  vi.stubGlobal('acceptHMRUpdate', acceptHMRUpdate)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { editorCapabilities: { mode: 'local' } } }))
  vi.stubGlobal('useConsoleStore', () => ({ success: vi.fn(), error: vi.fn(), warn: vi.fn() }))
  vi.stubGlobal('useFileStore', () => ({}))
  vi.stubGlobal('useOnlineStore', () => ({}))
  vi.stubGlobal('useGameStore', () => ({ loadGameFromConfig: (config: AdvGameConfig) => game.loadGameFromConfig(config) }))
  const { useProjectStore } = await import('../../../editor/core/app/stores/useProjectStore')
  project = useProjectStore()
  vi.stubGlobal('useProjectStore', () => project)
  game = useGameStore()
})

afterEach(() => {
  project.disconnectLocalBridge()
  disposePinia(pinia)
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function browserProject(name: string, config?: Record<string, unknown>) {
  const files: Record<string, string> = {
    'adv/settings/game.json': JSON.stringify({ title: name }),
    'adv/chapters/intro.adv.md': '> Begin.\n',
  }
  if (config)
    files['adv.config.json'] = JSON.stringify({ root: 'adv', ...config })
  function file(path: string) {
    return { kind: 'file' as const, name: path.split('/').at(-1)!, getFile: async () => ({ size: files[path].length, text: async () => files[path] }) }
  }
  function directory(path: string, name: string) {
    const prefix = path ? `${path}/` : ''
    return {
      kind: 'directory' as const,
      name,
      isSameEntry: async () => false,
      async* values(): AsyncGenerator<ReturnType<typeof file> | ReturnType<typeof directory>> {
        const children = new Set(Object.keys(files).filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length).split('/')[0]))
        for (const child of children) {
          const path = `${prefix}${child}`
          yield files[path] === undefined ? directory(path, child) : file(path)
        }
      },
    }
  }
  return directory('', name) as unknown as FileSystemDirectoryHandle
}

describe('editor project preview configuration', () => {
  it('applies declared avatar options before preview initialization and respects a later explicit disable', async () => {
    localStorage.setItem('host-theme-preference', 'dark')
    await project.openBrowserProject(browserProject('avatars-on', { showCharacterAvatar: true, viewportFit: 'responsive' }))
    await vi.waitFor(() => expect(initialized).toHaveLength(1))
    expect(initialized[0]).toEqual({ avatar: true, viewportFit: 'responsive', title: 'avatars-on' })
    await project.loadAdvConfigJSON('{"root":"adv","showCharacterAvatar":false}')
    await game.loadGameFromConfig(project.project!.previewConfig)
    expect(initialized[1]).toEqual({ avatar: false, viewportFit: 'contain', title: 'avatars-on' })
    expect(context.config.value.showCharacterAvatar).toBe(false)
    expect(localStorage.getItem('host-theme-preference')).toBe('dark')
  })

  it('resets project options on switches with omitted fields or a missing configuration file', async () => {
    const projects = [
      ['explicit-on', { showCharacterAvatar: true, viewportFit: 'responsive' }],
      ['explicit-off', { showCharacterAvatar: false }],
      ['on-before-default', { showCharacterAvatar: true, viewportFit: 'responsive' }],
      ['defaults', {}],
      ['on-before-missing', { showCharacterAvatar: true, viewportFit: 'responsive' }],
      ['missing-config', undefined],
    ] as const
    for (const [name, config] of projects) {
      await project.openBrowserProject(browserProject(name, config))
      // The compiler reports a missing config, so this snapshot is editable
      // without autostart. An explicit preview still uses the reset options.
      if (!config)
        await game.loadGameFromConfig(project.project!.previewConfig)
      await vi.waitFor(() => expect(initialized.at(-1)?.title).toBe(name))
    }
    expect(initialized.map(item => item.avatar)).toEqual([true, false, true, false, true, false])
    expect(initialized.map(item => item.viewportFit)).toEqual(['responsive', 'contain', 'responsive', 'contain', 'responsive', 'contain'])
    expect(project.advConfig.showCharacterAvatar).toBe(defaultAdvConfig.showCharacterAvatar)
    expect(context.config.value.showCharacterAvatar).toBe(defaultAdvConfig.showCharacterAvatar)
    expect(project.project!.files['adv.config.json']).toBeUndefined()
    expect(project.project!.files['adv/chapters/intro.adv.md']).toBe('> Begin.\n')
  })
})
