import type { App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, shallowRef } from 'vue'
import AGUICombobox from '../../../packages/gui/client/components/combobox/AGUICombobox.vue'

let app: App | undefined
const scrollIntoView = HTMLElement.prototype.scrollIntoView

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  HTMLElement.prototype.scrollIntoView = scrollIntoView
})

function mount(options: string[], initialValue = '') {
  const value = shallowRef(initialValue)
  const update = vi.fn((next: string) => value.value = next)
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({
    render: () => h(AGUICombobox, {
      'modelValue': value.value,
      'options': options,
      'onUpdate:modelValue': update,
    }),
  })
  app.mount(container)
  return { input: container.querySelector('input')!, value, update }
}

async function type(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('aGUI combobox model', () => {
  it('forwards label, description and disabled state to the actual editable field', () => {
    const container = document.createElement('div')
    document.body.append(container)
    app = createApp({ render: () => h(AGUICombobox, { 'id': 'config-url', 'label': 'Config URL', 'aria-describedby': 'url-help', 'disabled': true, 'modelValue': 'https://example.com' }) })
    app.mount(container)
    const input = container.querySelector('input')!
    expect(input.id).toBe('config-url')
    expect(input.getAttribute('aria-label')).toBe('Config URL')
    expect(input.getAttribute('aria-describedby')).toBe('url-help')
    expect(input.disabled).toBe(true)
  })

  it('updates freeform input and clearing without requiring a suggestion', async () => {
    const { input, value, update } = mount([], 'https://example.com/first.adv.json')
    await nextTick()
    expect(input.value).toBe(value.value)

    await type(input, 'https://example.com/second.adv.json')
    expect(update).toHaveBeenLastCalledWith('https://example.com/second.adv.json')
    expect(value.value).toBe(input.value)

    await type(input, '')
    expect(update).toHaveBeenLastCalledWith('')
    expect(value.value).toBe('')
  })

  it('filters a new search after selection and allows choosing another suggestion', async () => {
    const { input, value } = mount(['chapter_01.adv.md', 'chapter_02.adv.md'])
    await type(input, 'chapter')
    await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(2))
    document.querySelector<HTMLElement>('[role="option"]')!.click()
    await nextTick()
    expect(value.value).toBe('chapter_01.adv.md')
    // Reka resets the input after closing the first selection in a timer.
    await new Promise(resolve => setTimeout(resolve, 0))

    await type(input, 'chapter')
    await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(2))
    document.querySelectorAll<HTMLElement>('[role="option"]')[1].click()
    await nextTick()
    expect(value.value).toBe('chapter_02.adv.md')
    expect(input.value).toBe('chapter_02.adv.md')
  })
})
