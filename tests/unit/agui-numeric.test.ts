import type { App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import AGUINumberField from '../../packages/gui/client/components/AGUINumberField.vue'
import AGUINumberSlider from '../../packages/gui/client/components/AGUINumberSlider.vue'
import AGUISlider from '../../packages/gui/client/components/AGUISlider.vue'
import AGUIInputNumber from '../../packages/gui/client/components/input/AGUIInputNumber.vue'
import AGUIInputVector from '../../packages/gui/client/components/input/AGUIInputVector.vue'

import { mockResizeObserver } from '../helpers/resize-observer'

beforeEach(mockResizeObserver)

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})
function mount(render: () => ReturnType<typeof h>) {
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render })
  app.mount(container)
  return container
}
function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
function key(input: HTMLElement, value: string) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }))
}

describe('aGUI numeric editing', () => {
  it.each([AGUINumberField, AGUINumberSlider])('preserves precision, previews drafts, commits bounds and cancels edits', async (component) => {
    const value = ref(123456.789)
    const change = vi.fn()
    const update = vi.fn((next: number) => value.value = next)
    const container = mount(() => h(component, { 'modelValue': value.value, 'suffix': 'px', 'max': 200000, 'label': 'Position', 'onChange': change, 'onUpdate:modelValue': update }))
    const input = container.querySelector('input')!
    expect(input.value).toBe('123456.789px')
    input.focus()
    await nextTick()
    expect(input.value).toBe('123456.789')
    type(input, '900000')
    expect(change).toHaveBeenLastCalledWith(200000)
    expect(update).not.toHaveBeenCalled()
    key(input, 'Enter')
    await nextTick()
    expect(value.value).toBe(200000)
    expect(document.activeElement).not.toBe(input)
    input.focus()
    type(input, '42')
    key(input, 'Escape')
    await nextTick()
    expect(value.value).toBe(200000)
    expect(input.value).toBe('200000px')
    expect(change).toHaveBeenLastCalledWith(200000)
  })

  it('clamps stepping, avoids floating point noise and ignores invalid drafts', async () => {
    const value = ref(0.2)
    const container = mount(() => h(AGUINumberField, { 'id': 'opacity', 'modelValue': value.value, 'min': 0, 'max': 0.3, 'step': 0.1, 'onUpdate:modelValue': next => value.value = next }))
    const input = container.querySelector('input')!
    input.focus()
    await nextTick()
    key(input, 'ArrowUp')
    await nextTick()
    expect(value.value).toBe(0.3)
    key(input, 'ArrowUp')
    expect(value.value).toBe(0.3)
    type(input, 'not a number')
    input.blur()
    await nextTick()
    expect(input.value).toBe('0.3')
    expect(container.querySelector<HTMLButtonElement>('.increase')!.disabled).toBe(true)
  })

  it('scrubs within limits and stops on pointer cancellation', async () => {
    const value = ref(0)
    const container = mount(() => h(AGUINumberField, { 'modelValue': value.value, 'min': -1, 'max': 1, 'step': 0.1, 'onUpdate:modelValue': next => value.value = next }))
    const drag = container.querySelector('.agui-numeric-drag')!
    const pointer = (type: string, x: number) => drag.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, bubbles: true }))
    pointer('pointerdown', 0)
    pointer('pointermove', 50)
    await nextTick()
    expect(value.value).toBe(1)
    pointer('pointercancel', 50)
    pointer('pointermove', -50)
    await nextTick()
    expect(value.value).toBe(1)
    expect(container.querySelector('.agui-numeric-control')!.classList.contains('active')).toBe(false)
  })

  it('forwards labels and disabled state to every numeric interaction', () => {
    const update = vi.fn()
    const container = mount(() => h('div', [
      h(AGUINumberField, { 'modelValue': 5, 'disabled': true, 'aria-label': 'Count', 'onUpdate:modelValue': update }),
      h(AGUISlider, { 'modelValue': -2, 'min': -10, 'max': 0, 'showInput': true, 'disabled': true, 'label': 'Offset', 'onUpdate:modelValue': update }),
    ]))
    const inputs = [...container.querySelectorAll('input')]
    expect(inputs.every(input => input.disabled)).toBe(true)
    expect(inputs.map(input => input.getAttribute('aria-label'))).toEqual(['Count', 'Offset'])
    const slider = container.querySelector<HTMLButtonElement>('[role=slider]')!
    expect(slider.disabled).toBe(true)
    expect(slider.getAttribute('aria-label')).toBe('Offset')
    expect(slider.getAttribute('aria-valuemax')).toBe('0')
    expect(inputs[1].max).toBe('0')
    key(inputs[0], 'ArrowUp')
    key(slider, 'ArrowRight')
    container.querySelector('button')!.click()
    expect(update).not.toHaveBeenCalled()
    expect(container.querySelector('.agui-numeric-drag')).toBeNull()
  })

  it('keeps zero distinct from an empty native number input', async () => {
    const value = ref(2)
    const container = mount(() => h(AGUIInputNumber, { 'modelValue': value.value, 'onUpdate:modelValue': next => value.value = next }))
    const input = container.querySelector('input')!
    type(input, '')
    expect(value.value).toBe(2)
    type(input, '0')
    await nextTick()
    expect(value.value).toBe(0)
  })

  it('updates vectors immutably and associates unique axis labels', async () => {
    const initial = Object.freeze({ x: 1, y: 2 })
    const value = ref(initial)
    const update = vi.fn(next => value.value = next)
    const container = mount(() => h('div', [
      h(AGUIInputVector, { 'modelValue': value.value, 'label': 'Position', 'onUpdate:modelValue': update }),
      h(AGUIInputVector, { modelValue: { x: 3, y: 4 }, disabled: true }),
    ]))
    const inputs = [...container.querySelectorAll('input')]
    expect(new Set(inputs.map(input => input.id)).size).toBe(4)
    expect([...container.querySelectorAll('label')].map(label => label.control)).toEqual(inputs)
    inputs[0].focus()
    await nextTick()
    type(inputs[0], '9')
    key(inputs[0], 'Enter')
    await nextTick()
    expect(value.value).toEqual({ x: 9, y: 2 })
    expect(initial).toEqual({ x: 1, y: 2 })
    expect(value.value).not.toBe(initial)
    expect(inputs[2].disabled).toBe(true)
  })
})
