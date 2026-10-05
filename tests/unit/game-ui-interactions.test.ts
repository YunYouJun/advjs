import type { App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import AdvThemeScope from '../../packages/client/components/internals/AdvThemeScope.vue'
import AdvModal from '../../packages/client/components/ui/AdvModal.vue'
import { gameColorModeStorageKey, useGameColorMode } from '../../packages/client/composables/useGameColorMode'
import AdvIconButton from '../../themes/theme-default/components/ui/AdvIconButton.vue'

const { play } = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('@advjs/client', () => ({ useSound: () => ({ play }) }))
vi.mock('../../themes/theme-default/composables', () => ({ useThemeConfig: () => shallowRef({ audio: { volume: 0 } }) }))
vi.mock('../../packages/client/composables/useAdvMotionPreference', () => ({ useAdvMotionPreference: () => shallowRef('none') }))

const apps: App[] = []
const Controls = defineComponent({
  setup() {
    const mode = useGameColorMode()
    return () => h('div', [
      h('button', { 'onClick': mode.toggle, 'aria-pressed': mode.isDark.value }, 'Toggle'),
      h('button', { onClick: mode.reset }, 'Reset'),
    ])
  },
})
function mount(render: () => ReturnType<typeof h>, storageKey?: string) {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp({ render })
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: { button: { close: 'Close' }, ui: { dialog: 'Dialog' } } } }))
  app.component('AdvIconButton', AdvIconButton)
  app.component('AdvIcon', { render() {
    return h('span', this.$slots.default?.())
  } })
  app.component('HorizontalDivider', { render: () => h('hr') })
  if (storageKey)
    app.provide(gameColorModeStorageKey, storageKey)
  apps.push(app)
  app.mount(container)
  return container
}

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
  document.documentElement.classList.remove('dark')
  localStorage.clear()
  vi.restoreAllMocks()
  play.mockClear()
})

describe('game UI interactions', () => {
  it('isolates local toggles from the host and sibling games, and resets to the configured theme', async () => {
    document.documentElement.classList.add('dark')
    const root = mount(() => h('div', [
      h(AdvThemeScope, { theme: { ui: { colorScheme: 'light' } } }, () => h(Controls)),
      h(AdvThemeScope, { theme: { ui: { colorScheme: 'light' } } }, () => h(Controls)),
    ]))
    const games = root.querySelectorAll<HTMLElement>('[data-adv-ui=game]')
    games[0].querySelector('button')!.click()
    await nextTick()
    expect(games[0].dataset.advColorScheme).toBe('dark')
    expect(games[1].dataset.advColorScheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.length).toBe(0)
    games[0].querySelectorAll('button')[1].click()
    await nextTick()
    expect(games[0].dataset.advColorScheme).toBe('light')
  })

  it('inherits host mode until the player chooses a local mode', async () => {
    const root = mount(() => h(AdvThemeScope, {}, () => h(Controls)))
    const toggle = root.querySelector('button')!
    await nextTick()
    document.documentElement.classList.add('dark')
    await vi.waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('true'))
    toggle.click()
    await nextTick()
    expect(root.querySelector<HTMLElement>('[data-adv-ui=game]')!.dataset.advColorScheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('persists standalone mode across page scopes and lets previews opt out', async () => {
    const key = 'advjs:game-color-mode:/example/'
    const first = mount(() => h(AdvThemeScope, {}, () => h(Controls)), key)
    first.querySelector('button')!.click()
    await nextTick()
    expect(localStorage.getItem(key)).toBe('dark')
    const next = mount(() => h(AdvThemeScope, {}, () => h(Controls)), key)
    const preview = mount(() => h(AdvThemeScope, { colorModeStorageKey: false }, () => h(Controls)), key)
    await nextTick()
    expect(next.querySelector<HTMLElement>('[data-adv-ui=game]')!.dataset.advColorScheme).toBe('dark')
    expect(preview.querySelector('[data-adv-ui=game]')!.hasAttribute('data-adv-color-scheme')).toBe(false)
    next.querySelectorAll('button')[1].click()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('keeps local mode usable when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const root = mount(() => h(AdvThemeScope, { colorModeStorageKey: 'blocked' }, () => h(Controls)))
    root.querySelector('button')!.click()
    await nextTick()
    expect(root.querySelector<HTMLElement>('[data-adv-ui=game]')!.dataset.advColorScheme).toBe('dark')
  })

  it('renders named native buttons and suppresses disabled actions and sound', async () => {
    const disabled = shallowRef(true)
    const action = vi.fn()
    const root = mount(() => h('form', [h(AdvIconButton, { title: 'Quick save', disabled: disabled.value, onClick: action })]))
    const button = root.querySelector('button')!
    expect(button.type).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Quick save')
    button.click()
    expect(action).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
    disabled.value = false
    await nextTick()
    button.click()
    expect(action).toHaveBeenCalledOnce()
    expect(play).toHaveBeenCalledOnce()
  })

  it('keeps named modal content inside its theme, closes on Escape, and restores focus', async () => {
    const open = shallowRef(false)
    const close = vi.fn()
    const root = mount(() => h(AdvThemeScope, {}, () => [
      h('button', { onClick: () => open.value = true }, 'Settings'),
      h(AdvModal, { 'open': open.value, 'label': 'Game settings', 'onUpdate:open': value => open.value = value, 'onClose': close }, () => h('input', { 'aria-label': 'Volume' })),
    ]))
    const trigger = root.querySelector('button')!
    trigger.focus()
    trigger.click()
    await vi.waitFor(() => expect(root.querySelector('[role=dialog]')).not.toBeNull())
    const dialog = root.querySelector<HTMLElement>('[role=dialog]')!
    expect(dialog.closest('[data-adv-ui=game]')).not.toBeNull()
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Game settings')
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(root.querySelector('[role=dialog]')).toBeNull())
    expect(open.value).toBe(false)
    expect(close).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
