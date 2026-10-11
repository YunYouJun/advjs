import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { defineComponent, inject, reactive, shallowRef } from 'vue'
import AdvGame from '../../../packages/client/components/game/AdvGame.vue'
import { injectionAdvPlayer } from '../../../packages/client/constants'

const app = reactive({ showUi: true, menus: { settings: false }, showHistory: false, showSaveMenu: false, showLoadMenu: false })
const adv = {
  $auto: { paused: shallowRef(false), stop: vi.fn() },
  config: shallowRef({}),
  themeConfig: shallowRef({}),
  store: { current: undefined, state: { status: 'idle', stage: {} } },
  resources: { tachiesMapRef: shallowRef({}) },
}
vi.mock('@advjs/client', () => ({ useAppStore: () => app }))
vi.mock('../../../packages/client/composables', () => ({ useBeforeUnload: vi.fn() }))
vi.mock('../../../packages/client/composables/useAdvContext', () => ({ useAdvContext: () => ({ $adv: adv }) }))
vi.mock('../../../packages/client/composables/useAdvMotionPreference', () => ({ useAdvMotionPreference: () => shallowRef('none') }))

it('marks embedded descendants, pauses playback in every menu, and stops on unmount', () => {
  let inPlayer = false
  const Probe = defineComponent({
    setup() { inPlayer = inject(injectionAdvPlayer, false) },
    template: '<div />',
  })
  const wrapper = mount(AdvGame, {
    global: {
      stubs: {
        ...Object.fromEntries(['AdvScene', 'AdvPixiCanvas', 'AdvCg', 'AdvTachieBox', 'AdvBlack', 'BaseLayer', 'AdvDialogBox', 'AdvChoice', 'DialogControls', 'AdvActivity', 'AdvGameUI', 'AdvEnd'].map(name => [name, true])),
        AdvContainer: { template: '<div><slot /><slot name="controls" /></div>' },
        AdvGameModals: Probe,
      },
    },
  })
  expect(inPlayer).toBe(true)
  expect(adv.$auto.paused.value).toBe(false)
  app.menus.settings = true
  expect(adv.$auto.paused.value).toBe(true)
  app.showLoadMenu = true
  app.menus.settings = false
  expect(adv.$auto.paused.value).toBe(true)
  app.showLoadMenu = false
  expect(adv.$auto.paused.value).toBe(false)
  for (const key of ['showSaveMenu', 'showHistory'] as const) {
    app[key] = true
    expect(adv.$auto.paused.value).toBe(true)
    app[key] = false
    expect(adv.$auto.paused.value).toBe(false)
  }
  wrapper.unmount()
  expect(adv.$auto.stop).toHaveBeenCalledOnce()
})
