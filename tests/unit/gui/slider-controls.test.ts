import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AGUISlider from '../../../packages/gui/client/components/AGUISlider.vue'
import AdvSlider from '../../../themes/theme-default/components/ui/AdvSlider.vue'
import { mockResizeObserver } from '../../helpers/resize-observer'

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

describe('editor vertical slider', () => {
  it('uses real vertical geometry, exposes spoken values on the thumb and keeps Up/Down/Home/End controlled', async () => {
    const wrapper = mount(AGUISlider, { props: { modelValue: 25, min: 0, max: 100, step: 5, orientation: 'vertical', variant: 'media', showInput: true, label: '音量' }, attrs: { 'aria-valuetext': '25%', 'style': { height: '180px' } } })
    try {
      const thumb = wrapper.get('[role="slider"]')
      expect(thumb.attributes('aria-orientation')).toBe('vertical')
      expect(thumb.attributes('aria-label')).toBe('音量')
      expect(thumb.attributes('aria-valuetext')).toBe('25%')
      expect(wrapper.get('.agui-slider').attributes('aria-valuetext')).toBeUndefined()
      expect(wrapper.get('.agui-slider-range').attributes('data-orientation')).toBe('vertical')
      expect(wrapper.get('.agui-slider-range').attributes('style')).toContain('bottom: 0%')
      expect(wrapper.get('.agui-slider-range').attributes('style')).toContain('top: 75%')
      expect(wrapper.attributes('style')).toContain('height: 180px')
      expect(wrapper.classes()).toContain('agui-slider-container--media')
      for (const [key, expected] of [['ArrowUp', 30], ['ArrowDown', 25], ['Home', 0], ['End', 100]] as const) {
        await thumb.trigger('keydown', { key })
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([expected])
        expect(wrapper.emitted('input')?.at(-1)).toEqual([expected])
        await wrapper.setProps({ modelValue: expected })
        expect(thumb.attributes('aria-valuenow')).toBe(String(expected))
        expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe(String(expected))
      }
    }
    finally { wrapper.unmount() }
  })

  it('disables vertical keyboard and numeric edits while keeping the optional input after the track', async () => {
    const wrapper = mount(AGUISlider, { props: { modelValue: 40, min: 0, max: 100, orientation: 'vertical', showInput: true, disabled: true } })
    try {
      expect(wrapper.attributes('data-orientation')).toBe('vertical')
      expect(wrapper.classes()).toContain('agui-slider-container--with-input')
      const thumb = wrapper.get('[role="slider"]')
      expect((thumb.element as HTMLButtonElement).disabled).toBe(true)
      expect(thumb.attributes('aria-orientation')).toBe('vertical')
      for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End'])
        await thumb.trigger('keydown', { key })
      const input = wrapper.get('input[type="number"]')
      expect((input.element as HTMLInputElement).disabled).toBe(true)
      expect(input.element.previousElementSibling).toBe(wrapper.get('.agui-slider').element)
      await input.setValue('90')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('input')).toBeUndefined()
    }
    finally { wrapper.unmount() }
  })
})
