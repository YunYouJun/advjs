import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import AGUISlider from '../../../packages/gui/client/components/AGUISlider.vue'
import AGUIButton from '../../../packages/gui/client/components/button/AGUIButton.vue'
import AGUIPopover from '../../../packages/gui/client/components/popover/AGUIPopover.vue'
import { mockResizeObserver } from '../../helpers/resize-observer'

const wrappers: VueWrapper[] = []
beforeEach(mockResizeObserver)
afterEach(async () => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  await nextTick()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function fixture(onCloseAutoFocus?: (event: Event) => void) {
  const open = shallowRef(false)
  const value = shallowRef(50)
  const changes = vi.fn((next: boolean) => open.value = next)
  const wrapper = mount(defineComponent({
    setup: () => () => h('div', [
      h(AGUIPopover, { 'open': open.value, 'onUpdate:open': changes, 'label': '音量调节', onCloseAutoFocus }, {
        trigger: () => h(AGUIButton, { 'aria-label': '调整音量', 'data-testid': 'volume-trigger' }, () => '音量'),
        default: () => h(AGUISlider, { 'modelValue': value.value, 'onUpdate:modelValue': (next: number) => value.value = next, 'orientation': 'vertical', 'label': '音量', 'min': 0, 'max': 100 }),
      }),
      h('button', { 'type': 'button', 'data-testid': 'outside' }, '外部操作'),
    ]),
  }), { attachTo: document.body })
  wrappers.push(wrapper)
  return { wrapper, open, changes, trigger: wrapper.get<HTMLButtonElement>('[data-testid="volume-trigger"]'), outside: wrapper.get<HTMLButtonElement>('[data-testid="outside"]') }
}

describe('aGUI popover', () => {
  it('uses one native trigger, names the portal dialog, focuses its first control and returns focus after Escape', async () => {
    const f = fixture()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(f.wrapper.findAll('[data-testid="volume-trigger"]')).toHaveLength(1)
    expect(f.trigger.element.tagName).toBe('BUTTON')
    await f.trigger.trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull(), { timeout: 3000 })
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-label')).toBe('音量调节')
    expect(f.wrapper.element.contains(dialog)).toBe(false)
    expect(f.trigger.attributes('aria-expanded')).toBe('true')
    expect(f.trigger.attributes('aria-controls')).toBe(dialog.id)
    await vi.waitFor(() => expect(document.activeElement).toBe(dialog.querySelector('[role="slider"]')), { timeout: 3000 })
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull(), { timeout: 3000 })
    expect(f.open.value).toBe(false)
    expect(f.changes.mock.calls.map(call => call[0])).toEqual([true, false])
    await vi.waitFor(() => expect(document.activeElement).toBe(f.trigger.element), { timeout: 3000 })
  })

  it('dismisses an outside pointer interaction without forcing focus back to the trigger', async () => {
    const f = fixture()
    await f.trigger.trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull(), { timeout: 3000 })
    // DismissableLayer installs its document pointer listener after mount.
    await new Promise(resolve => setTimeout(resolve, 0))
    f.outside.element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }))
    await vi.waitFor(() => expect(f.open.value).toBe(false), { timeout: 3000 })
    f.outside.element.focus()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull(), { timeout: 3000 })
    expect(document.activeElement).toBe(f.outside.element)
  })

  it('honors controlled closing and forwards a cancellable close-auto-focus event for layout changes', async () => {
    const close = vi.fn((event: Event) => event.preventDefault())
    const f = fixture(close)
    f.open.value = true
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull(), { timeout: 3000 })
    f.open.value = false
    await vi.waitFor(() => expect(close).toHaveBeenCalled(), { timeout: 3000 })
    expect(close.mock.calls.every(([event]) => event.defaultPrevented)).toBe(true)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).not.toBe(f.trigger.element)
  })

  it('supports a labeled default trigger, optional arrow and Content attributes without nesting buttons', async () => {
    const wrapper = mount(AGUIPopover, { props: { label: 'Local settings', arrow: true, side: 'right', align: 'start', sideOffset: 4 }, attrs: { 'class': 'custom-popover', 'data-testid': 'local-settings' }, slots: { default: '<button type="button">Apply</button>' }, attachTo: document.body })
    wrappers.push(wrapper)
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.get('button').text()).toBe('Local settings')
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[data-testid="local-settings"]')).not.toBeNull(), { timeout: 3000 })
    const dialog = document.querySelector<HTMLElement>('[data-testid="local-settings"]')!
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Local settings')
    expect(dialog.classList.contains('agui-popover-content')).toBe(true)
    expect(dialog.classList.contains('custom-popover')).toBe(true)
    expect(dialog.querySelector('svg')).not.toBeNull()
    wrapper.unmount()
    expect(document.querySelector('[data-testid="local-settings"]')).toBeNull()
  })
})
