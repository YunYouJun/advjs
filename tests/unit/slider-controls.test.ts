import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AGUISlider from '../../packages/gui/client/components/AGUISlider.vue'
import AdvSlider from '../../themes/theme-default/components/ui/AdvSlider.vue'
import { mockResizeObserver } from '../helpers/resize-observer'

beforeEach(mockResizeObserver)
afterEach(() => vi.unstubAllGlobals())

describe.each([
  { name: 'game slider', component: AdvSlider, extra: {} },
  { name: 'editor slider', component: AGUISlider, extra: { showInput: true } },
])('$name', ({ component, extra }) => {
  function render(disabled = false) {
    return mount(component, {
      props: { modelValue: 0.5, min: 0, max: 1, step: 0.05, disabled, ...extra },
      attrs: { 'id': 'volume', 'aria-label': 'Volume', 'aria-describedby': 'volume-description' },
    })
  }

  it('names the focusable thumb and keeps the scalar events and controlled value', async () => {
    const wrapper = render()
    await vi.waitFor(() => expect(wrapper.get('[role="slider"]').attributes('aria-valuenow')).toBe('0.5'))
    const slider = wrapper.get('[role="slider"]')
    expect(slider.attributes('id')).toBe('volume')
    expect(slider.attributes('aria-label')).toBe('Volume')
    expect(slider.attributes('aria-describedby')).toBe('volume-description')
    await slider.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0.55])
    expect(wrapper.emitted('input')?.at(-1)).toEqual([0.55])
    await wrapper.setProps({ modelValue: 0.55 })
    expect(slider.attributes('aria-valuenow')).toBe('0.55')
    expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('0.55')
    await slider.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0])
    await wrapper.setProps({ modelValue: 0 })
    await slider.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1])
    wrapper.unmount()
  })

  it('clamps numeric edits and restores an empty draft without emitting a false zero', async () => {
    const wrapper = render()
    const input = wrapper.get('input[type="number"]')
    await input.setValue('0.37')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0.37])
    await wrapper.setProps({ modelValue: 0.37 })
    await input.setValue('2')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1])
    await input.setValue('')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(2)
    await input.trigger('blur')
    expect((input.element as HTMLInputElement).value).toBe('0.37')
    wrapper.unmount()
  })

  it('disables both inputs and ignores attempted keyboard or numeric changes', async () => {
    const wrapper = render(true)
    const slider = wrapper.get('[role="slider"]')
    expect((slider.element as HTMLButtonElement).disabled).toBe(true)
    expect(slider.attributes('tabindex')).toBeUndefined()
    expect(slider.attributes('aria-disabled')).toBe('true')
    await slider.trigger('keydown', { key: 'ArrowRight' })
    const input = wrapper.get('input[type="number"]')
    expect((input.element as HTMLInputElement).disabled).toBe(true)
    await input.setValue('0.75')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
