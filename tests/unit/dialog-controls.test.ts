import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import BaseLayer from '../../packages/client/components/base/BaseLayer.vue'
import DialogControls from '../../packages/client/components/internals/dialog/DialogControls.vue'
import AdvGameUI from '../../packages/client/components/ui/AdvGameUI.vue'
import { useAdvKeys } from '../../packages/client/composables/useAdvKeys'
import { useAppStore } from '../../packages/client/stores/app'
import { useSettingsStore } from '../../packages/client/stores/settings'

let app: ReturnType<typeof useAppStore>
const enabled = shallowRef(false)
const skipEnabled = shallowRef(false)
const runtime = { snapshot: vi.fn(() => ({ cursor: 'opening' })), restore: vi.fn(), next: vi.fn() }
const game = { save: vi.fn(async () => undefined), read: vi.fn(async () => undefined) }
const fullscreen = {
  isSupported: shallowRef(true),
  isFullscreen: shallowRef(false),
  toggle: vi.fn(async () => { fullscreen.isFullscreen.value = !fullscreen.isFullscreen.value }),
}
const adv = {
  runtime,
  $auto: {
    enabled,
    skipEnabled,
    toggle: () => { enabled.value = !enabled.value },
    toggleSkip: () => { skipEnabled.value = !skipEnabled.value },
  },
  $bgm: { isMuted: shallowRef(false), toggleMute: vi.fn(() => { adv.$bgm.isMuted.value = !adv.$bgm.isMuted.value }) },
  gameConfig: shallowRef({}),
}

vi.mock('@advjs/client', () => ({
  useAppStore: () => app,
  useAdvContext: () => ({ $adv: adv }),
  useGameStore: () => game,
  QUICK_SAVE_SLOT: { kind: 'quick' },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@vueuse/core', async importOriginal => ({
  ...await importOriginal<typeof import('@vueuse/core')>(),
  useFullscreen: () => fullscreen,
}))

const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  app = useAppStore()
  enabled.value = false
  skipEnabled.value = false
  adv.$bgm.isMuted.value = false
  fullscreen.isSupported.value = true
  fullscreen.isFullscreen.value = false
  vi.clearAllMocks()
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function renderControls(withKeys = false) {
  const advance = vi.fn()
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: {} })
  const host = defineComponent({
    setup() {
      if (withKeys)
        useAdvKeys(adv as unknown as Parameters<typeof useAdvKeys>[0])
      return () => h('div', { class: 'adv-screen', onClick: advance }, app.showUi ? [h(DialogControls), h(AdvGameUI)] : [h(BaseLayer)])
    },
  })
  const wrapper = mount(host, { attachTo: document.body, global: { plugins: [i18n] } })
  wrappers.push(wrapper)
  const button = (text: string) => wrapper.findAll('button').find(item => item.attributes('aria-label') === text || item.text() === text)!
  return { wrapper, button, advance, i18n }
}

it('operates playback and hides/restores dialogue without advancing the story', async () => {
  const { wrapper, button, advance, i18n } = renderControls()
  await button('自动').trigger('click')
  expect(button('自动').attributes('aria-pressed')).toBe('true')
  await button('快进').trigger('click')
  expect(button('快进').attributes('aria-pressed')).toBe('true')
  await button('存档').trigger('click')
  expect(app.showSaveMenu).toBe(true)
  app.showSaveMenu = false
  await button('读档').trigger('click')
  expect(app.showLoadMenu).toBe(true)
  app.showLoadMenu = false
  await button('隐藏').trigger('click')
  await wrapper.get('button[aria-label="显示对话"]').trigger('click')
  expect(button('回看').isVisible()).toBe(true)
  expect(advance).not.toHaveBeenCalled()
  i18n.global.locale.value = 'en'
  await nextTick()
  expect(button('History').isVisible()).toBe(true)
})

it('keeps secondary controls behind the menu and blocks duplicate quick saves', async () => {
  const { wrapper, button, advance } = renderControls()
  expect(button('快速存档').isVisible()).toBe(false)
  await button('菜单').trigger('click')
  expect(button('快速存档').isVisible()).toBe(true)
  let finish!: () => void
  game.save.mockImplementationOnce(() => new Promise<void>((resolve) => {
    finish = resolve
  }))
  await button('快速存档').trigger('click')
  expect(button('快速存档').attributes('disabled')).toBeDefined()
  expect(button('快速读档').attributes('disabled')).toBeDefined()
  await button('快速存档').trigger('click')
  expect(game.save).toHaveBeenCalledTimes(1)
  finish()
  await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toBe('已快速存档')
  await button('菜单').trigger('keydown', { key: 'Escape' })
  expect(button('快速存档').isVisible()).toBe(false)
  expect(advance).not.toHaveBeenCalled()
})

it('exposes system icons directly and reflects mute/fullscreen state without advancing', async () => {
  const { wrapper, button, advance, i18n } = renderControls()
  expect(wrapper.get('.dialog-controls').find('[aria-label="设置"]').exists()).toBe(false)
  expect(button('设置').isVisible()).toBe(true)
  await button('关闭音乐').trigger('click')
  expect(button('开启音乐').attributes('aria-pressed')).toBe('true')
  await button('开启音乐').trigger('click')
  expect(button('关闭音乐').attributes('aria-pressed')).toBe('false')
  await button('全屏').trigger('click')
  await flushPromises()
  expect(button('退出全屏').attributes('aria-pressed')).toBe('true')
  await button('退出全屏').trigger('click')
  await flushPromises()
  await button('设置').trigger('click')
  expect(app.menus.settings).toBe(true)
  expect(advance).not.toHaveBeenCalled()
  i18n.global.locale.value = 'en'
  await nextTick()
  expect(button('Settings').attributes('aria-label')).toBe('Settings')
})

it('hides unsupported fullscreen controls and reports a rejected request without getting stuck', async () => {
  fullscreen.isSupported.value = false
  const { wrapper, button } = renderControls()
  expect(wrapper.find('button[aria-label="全屏"]').exists()).toBe(false)
  fullscreen.isSupported.value = true
  await nextTick()
  fullscreen.toggle.mockRejectedValueOnce(new Error('Permission denied'))
  await button('全屏').trigger('click')
  await flushPromises()
  expect(wrapper.get('.game-toolbar-feedback').text()).toContain('暂时无法进入全屏')
  expect(button('全屏').attributes('disabled')).toBeUndefined()
  await button('全屏').trigger('click')
  await flushPromises()
  expect(wrapper.find('.game-toolbar-feedback').exists()).toBe(false)
})

it('closes the menu with Escape and returns keyboard focus to its icon', async () => {
  const { button } = renderControls()
  await button('菜单').trigger('click')
  button('快速存档').element.focus()
  await button('快速存档').trigger('keydown', { key: 'Escape' })
  expect(button('菜单').attributes('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(button('菜单').element)
})

it('dismisses the menu without treating the outside click as a story action', async () => {
  const { wrapper, button, advance } = renderControls()
  await button('菜单').trigger('click')
  await new Promise(resolve => setTimeout(resolve, 0))
  await wrapper.get('.adv-screen').trigger('pointerdown')
  wrapper.element.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }))
  await nextTick()
  expect(button('菜单').attributes('aria-expanded')).toBe('false')
  expect(advance).not.toHaveBeenCalled()
})

it('keeps keyboard playback shortcuts separate from focused controls', async () => {
  const { button } = renderControls(true)
  button('自动').element.focus()
  await button('自动').trigger('keydown', { key: ' ', code: 'Space' })
  expect(runtime.next).not.toHaveBeenCalled()
  await button('自动').trigger('keyup', { key: ' ', code: 'Space' })
  button('自动').element.blur()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }))
  await nextTick()
  expect(runtime.next).toHaveBeenCalledOnce()
  window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true }))
  await nextTick()
  expect(skipEnabled.value).toBe(true)
  button('自动').element.focus()
  await button('自动').trigger('keyup', { key: 'Control', code: 'ControlLeft', ctrlKey: false })
  expect(skipEnabled.value).toBe(false)
})

it('collapses only the controls and keeps playback stoppable without advancing', async () => {
  const { wrapper, button, advance } = renderControls()
  enabled.value = true
  skipEnabled.value = true
  await button('收起操作栏').trigger('click')
  expect(app.showUi).toBe(true)
  expect(useSettingsStore().storage.dialogBar).toBe('collapsed')
  expect(wrapper.get('.dialog-controls').attributes('inert')).toBeDefined()
  expect(button('展开操作栏').isVisible()).toBe(true)
  await button('快进中 · 停止').trigger('click')
  expect(skipEnabled.value).toBe(false)
  expect(enabled.value).toBe(false)
  await button('展开操作栏').trigger('click')
  expect(wrapper.get('.dialog-controls').attributes('inert')).toBeUndefined()
  expect(document.activeElement).toBe(button('回看').element)
  expect(advance).not.toHaveBeenCalled()
})

it('shows explanatory hints on mouse hover, dismisses with Escape and ignores touch hover', async () => {
  vi.useFakeTimers()
  const { wrapper, button } = renderControls()
  const music = button('关闭音乐')
  await music.trigger('pointermove', { pointerType: 'touch' })
  await vi.advanceTimersByTimeAsync(500)
  expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  await music.trigger('pointermove', { pointerType: 'mouse' })
  await vi.advanceTimersByTimeAsync(500)
  expect(wrapper.get('[role="tooltip"]').text()).toContain('音效使用独立设置')
  expect(music.attributes('aria-describedby')).toBeTruthy()
  await music.trigger('keydown', { key: 'Escape' })
  await nextTick()
  expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
})

it('keeps the compact reveal button in place while the mouse approaches it', async () => {
  vi.useFakeTimers()
  const { wrapper, button } = renderControls()
  useSettingsStore().storage.dialogBar = 'auto'
  await nextTick()
  await vi.advanceTimersByTimeAsync(3000)
  const reveal = button('展开操作栏')
  await reveal.trigger('pointerover', { pointerType: 'mouse' })
  expect(wrapper.get('.dialog-controls').attributes('inert')).toBeDefined()
  await reveal.trigger('click')
  expect(wrapper.get('.dialog-controls').attributes('inert')).toBeUndefined()
})
