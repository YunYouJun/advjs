import type { ThemeConfig } from '@advjs/types'
import type { App } from 'vue'
import { themeConfigSymbol } from '@advjs/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import AdvContainer from '../../../packages/client/components/internals/AdvContainer.vue'
import { useThemeConfig } from '../../../packages/client/composables/config'

vi.mock('../../../packages/client/stores', () => ({
  useAppStore: () => ({ isHorizontal: true, rotation: 0, transition: false }),
}))

const apps: App[] = []
const hosts: HTMLElement[] = []
function mount(theme = shallowRef<ThemeConfig | undefined>(), provided?: ThemeConfig) {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const app = createApp({
    render: () => h(AdvContainer, { theme: theme.value, width: 320 }, () => h('button', '继续')),
  })
  if (provided)
    app.provide(themeConfigSymbol, computed(() => provided))
  apps.push(app)
  app.mount(host)
  return host.querySelector<HTMLElement>('[data-adv-ui="game"]')!
}

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  hosts.splice(0).forEach(host => host.remove())
  vi.restoreAllMocks()
})

describe('game UI theme contract', () => {
  it('preserves unconfigured containers and their content', () => {
    const root = mount()
    expect(root.hasAttribute('data-adv-color-scheme')).toBe(false)
    expect(root.style.width).toBe('320px')
    expect(root.style.getPropertyValue('--adv-c-primary')).toBe('')
    expect(root.querySelector('button')?.textContent).toBe('继续')
  })

  it('updates and removes local overrides without mutating the host document', async () => {
    const original = document.documentElement.outerHTML.split('<body')[0]
    const controls = { '--adv-control-color': '#29241d', '--adv-control-hover-bg': '#f1eadb', '--adv-control-hover-border': '#705226', '--adv-control-active-bg': '#ead6a9', '--adv-control-active-color': '#705226', '--adv-control-radius': '5px', '--adv-tooltip-bg': '#faf5ea', '--adv-tooltip-border': '#705226' } as const
    const theme = shallowRef<ThemeConfig | undefined>({
      ui: { colorScheme: 'light', tokens: { '--adv-c-primary': '#603020', ...controls } },
    })
    const root = mount(theme)
    expect(root.dataset.advColorScheme).toBe('light')
    expect(root.style.getPropertyValue('--adv-c-primary')).toBe('#603020')
    for (const [name, value] of Object.entries(controls))
      expect(root.style.getPropertyValue(name)).toBe(value)
    theme.value = { ui: { colorScheme: 'dark', tokens: { '--adv-choice-radius': '6px' } } }
    await nextTick()
    expect(root.dataset.advColorScheme).toBe('dark')
    expect(root.style.getPropertyValue('--adv-c-primary')).toBe('')
    for (const name of Object.keys(controls))
      expect(root.style.getPropertyValue(name)).toBe('')
    expect(root.style.getPropertyValue('--adv-choice-radius')).toBe('6px')
    theme.value = undefined
    await nextTick()
    expect(root.hasAttribute('data-adv-color-scheme')).toBe(false)
    expect(root.style.getPropertyValue('--adv-choice-radius')).toBe('')
    expect(document.documentElement.outerHTML.split('<body')[0]).toBe(original)
  })

  it('keeps sibling game themes independent', async () => {
    const theme = shallowRef<ThemeConfig | undefined>({ ui: { colorScheme: 'dark', tokens: { '--adv-dialog-color': '#ffccaa' } } })
    const first = mount(theme)
    const second = mount(shallowRef({ ui: { colorScheme: 'light', tokens: { '--adv-dialog-color': '#123456' } } }))
    theme.value = { ui: { colorScheme: 'light' } }
    await nextTick()
    expect(first.style.getPropertyValue('--adv-dialog-color')).toBe('')
    expect(second.style.getPropertyValue('--adv-dialog-color')).toBe('#123456')
  })

  it('uses the injected theme when no explicit theme is supplied', async () => {
    const theme = shallowRef<ThemeConfig | undefined>()
    const root = mount(theme, { ui: { colorScheme: 'dark' } })
    expect(root.dataset.advColorScheme).toBe('dark')
    theme.value = {}
    await nextTick()
    expect(root.hasAttribute('data-adv-color-scheme')).toBe(false)
    theme.value = undefined
    await nextTick()
    expect(root.dataset.advColorScheme).toBe('dark')
  })

  it('ignores editor/Studio properties and malformed untyped token values', () => {
    const theme = {
      ui: {
        colorScheme: 'invalid',
        tokens: {
          '--agui-c-primary': 'red',
          '--adv-color-primary': 'purple',
          '--adv-editor-bg': 'gold',
          'position': 'fixed',
          '--adv-c-primary': 123,
          '--adv-theme-paper': 'linen',
        },
      },
    } as unknown as ThemeConfig
    const root = mount(shallowRef(theme))
    expect(root.hasAttribute('data-adv-color-scheme')).toBe(false)
    expect(root.style.getPropertyValue('--adv-theme-paper')).toBe('linen')
    for (const property of ['--agui-c-primary', '--adv-color-primary', '--adv-editor-bg', '--adv-c-primary', 'position'])
      expect(root.style.getPropertyValue(property)).toBe('')
  })

  it('provides each explicit container theme to descendant theme components', async () => {
    const Consumer = defineComponent({
      setup() {
        const theme = useThemeConfig<{ paper: string }>()
        return () => h('span', theme.value.paper)
      },
    })
    const theme = shallowRef({ paper: 'Local' })
    const host = document.createElement('div')
    hosts.push(host)
    const app = createApp({ render: () => h(AdvContainer, { theme: theme.value }, () => h(Consumer)) })
    apps.push(app)
    app.provide(themeConfigSymbol, computed(() => ({ paper: 'Host' })))
    app.mount(host)
    expect(host.textContent).toBe('Local')
    theme.value = { paper: 'Updated' }
    await nextTick()
    expect(host.textContent).toBe('Updated')
  })

  it('exposes typed theme extensions through the shared injection reader', async () => {
    interface PaperTheme extends ThemeConfig { paper: { grain: boolean } }
    const theme = shallowRef<PaperTheme>({ paper: { grain: true } })
    const Consumer = defineComponent({
      setup() {
        const config = useThemeConfig<PaperTheme>()
        return () => h('span', config.value.paper.grain ? '纹理' : '纯色')
      },
    })
    const host = document.createElement('div')
    hosts.push(host)
    const app = createApp(Consumer)
    apps.push(app)
    app.provide(themeConfigSymbol, computed(() => theme.value))
    app.mount(host)
    expect(host.textContent).toBe('纹理')
    theme.value = { paper: { grain: false } }
    await nextTick()
    expect(host.textContent).toBe('纯色')
  })
})
