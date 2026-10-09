import type { DialogBarMode } from '../../../packages/client/stores/settings/types'
import { ns } from '@advjs/core'
import { mount } from '@vue/test-utils'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import DialogBarSettings from '../../../packages/client/components/menu/settings/DialogBarSettings.vue'
import { useDialogBarPreference } from '../../../packages/client/composables/useDialogBarPreference'
import { useDialogBarVisibility } from '../../../packages/client/composables/useDialogBarVisibility'
import { useSettingsStore } from '../../../packages/client/stores/settings'

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

it('restores the chosen display mode across sessions and tolerates older saved settings', async () => {
  let pinia = createPinia()
  setActivePinia(pinia)
  const settings = useSettingsStore()
  delete settings.storage.dialogBar
  await nextTick()
  const mode = useDialogBarPreference()
  expect(mode.value).toBe('always')
  const wrapper = mount(DialogBarSettings, {
    global: { plugins: [pinia, createI18n({ legacy: false, locale: 'zh-CN' })] },
  })
  await wrapper.get('input[value="auto"]').setValue()
  expect(settings.storage.dialogBar).toBe('auto')
  await nextTick()
  expect(JSON.parse(localStorage.getItem(ns('settings'))!).dialogBar).toBe('auto')
  wrapper.unmount()
  disposePinia(pinia)
  pinia = createPinia()
  setActivePinia(pinia)
  expect(useDialogBarPreference().value).toBe('auto')
  useSettingsStore().resetSettings()
  expect(useDialogBarPreference().value).toBe('always')
  disposePinia(pinia)
})

it('auto-hides after inactivity, but keeps controls open while hovering, focusing or reading a hint', async () => {
  vi.useFakeTimers()
  const scope = effectScope()
  const mode = shallowRef<DialogBarMode>('auto')
  const bar = scope.run(() => useDialogBarVisibility(mode))!
  await vi.advanceTimersByTimeAsync(3000)
  expect(bar.visible.value).toBe(false)
  bar.setHover(true)
  await vi.advanceTimersByTimeAsync(4000)
  expect(bar.visible.value).toBe(true)
  bar.setHover(false)
  bar.hintOpen.value = true
  await vi.advanceTimersByTimeAsync(4000)
  expect(bar.visible.value).toBe(true)
  bar.hintOpen.value = false
  bar.focused.value = true
  await vi.advanceTimersByTimeAsync(4000)
  expect(bar.visible.value).toBe(true)
  bar.focused.value = false
  await vi.advanceTimersByTimeAsync(3000)
  expect(bar.visible.value).toBe(false)
  scope.stop()
})

it('respects explicit collapsed mode, mode changes and disposal of pending timers', async () => {
  vi.useFakeTimers()
  const scope = effectScope()
  const mode = shallowRef<DialogBarMode>('collapsed')
  const bar = scope.run(() => useDialogBarVisibility(mode))!
  bar.setHover(true)
  expect(bar.visible.value).toBe(false)
  bar.expand()
  await vi.advanceTimersByTimeAsync(4000)
  expect(bar.visible.value).toBe(true)
  bar.collapse()
  mode.value = 'always'
  await nextTick()
  expect(bar.visible.value).toBe(true)
  mode.value = 'auto'
  bar.setHover(false)
  await nextTick()
  scope.stop()
  await vi.advanceTimersByTimeAsync(4000)
  expect(bar.visible.value).toBe(true)
})
