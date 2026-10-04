import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import BaseLayer from '../../packages/client/components/base/BaseLayer.vue'
import DialogControls from '../../packages/client/components/internals/dialog/DialogControls.vue'
import { useAdvKeys } from '../../packages/client/composables/useAdvKeys'
import { useAppStore } from '../../packages/client/stores/app'

let app: ReturnType<typeof useAppStore>
const enabled = shallowRef(false)
const skipEnabled = shallowRef(false)
const runtime = { snapshot: vi.fn(() => ({ cursor: 'opening' })), restore: vi.fn(), next: vi.fn() }
const game = { save: vi.fn(async () => undefined), read: vi.fn(async () => undefined) }
const adv = {
  runtime,
  $auto: {
    enabled,
    skipEnabled,
    toggle: () => { enabled.value = !enabled.value },
    toggleSkip: () => { skipEnabled.value = !skipEnabled.value },
  },
  $bgm: { isMuted: shallowRef(false), toggleMute: vi.fn() },
  gameConfig: shallowRef({}),
}

vi.mock('@advjs/client', () => ({
  useAppStore: () => app,
  useAdvContext: () => ({ $adv: adv }),
  useGameStore: () => game,
  QUICK_SAVE_SLOT: { kind: 'quick' },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  app = useAppStore()
  enabled.value = false
  skipEnabled.value = false
  vi.clearAllMocks()
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
})

function renderControls(withKeys = false) {
  const advance = vi.fn()
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: {} })
  const host = defineComponent({
    setup() {
      if (withKeys)
        useAdvKeys(adv as unknown as Parameters<typeof useAdvKeys>[0])
      return () => h('div', { onClick: advance }, [app.showUi ? h(DialogControls) : h(BaseLayer)])
    },
  })
  const wrapper = mount(host, { attachTo: document.body, global: { plugins: [i18n] } })
  wrappers.push(wrapper)
  const button = (text: string) => wrapper.findAll('button').find(item => item.text() === text)!
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
