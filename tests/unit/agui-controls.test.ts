import type { App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import AGUIDetails from '../../packages/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '../../packages/gui/client/components/AGUIProperty.vue'
import AGUIIconButton from '../../packages/gui/client/components/button/AGUIIconButton.vue'
import AGUIDialog from '../../packages/gui/client/components/dialog/AGUIDialog.vue'
import AGUIInput from '../../packages/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '../../packages/gui/client/components/select/AGUISelect.vue'
import AGUISwitch from '../../packages/gui/client/components/switch/AGUISwitch.vue'
import AGUIToolbar from '../../packages/gui/client/components/toolbar/AGUIToolbar.vue'

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

describe('aGUI control contracts', () => {
  it('forwards field attributes and model updates to a prefixed input', async () => {
    const disabled = ref(true)
    const update = vi.fn()
    const container = mount(() => h(AGUIInput, { 'prefixIcon': 'i-ri-search-line', 'id': 'project-name', 'aria-label': 'Project name', 'disabled': disabled.value, 'modelValue': 'First', 'onUpdate:modelValue': update }))
    const input = container.querySelector('input')!
    expect(input.id).toBe('project-name')
    expect(input.getAttribute('aria-label')).toBe('Project name')
    expect(input.disabled).toBe(true)
    disabled.value = false
    await nextTick()
    input.value = 'Second'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(update).toHaveBeenCalledWith('Second')
  })

  it('associates distinct switch labels and preserves disabled state', async () => {
    const container = mount(() => h('div', [h(AGUISwitch, { id: 'music', label: 'Music' }), h(AGUISwitch, { label: 'Sound', disabled: true })]))
    const labels = [...container.querySelectorAll('label')]
    const switches = [...container.querySelectorAll<HTMLButtonElement>('[role=switch]')]
    expect(labels.map(label => label.htmlFor)).toEqual(switches.map(control => control.id))
    expect(new Set(switches.map(control => control.id)).size).toBe(2)
    expect(switches[0].id).toBe('music')
    labels[0].click()
    await nextTick()
    expect(switches[0].getAttribute('aria-checked')).toBe('true')
    labels[1].click()
    await nextTick()
    expect(switches[1].getAttribute('aria-checked')).toBe('false')
    expect(switches[1].disabled).toBe(true)
  })

  it('names select triggers and preserves disabled state', () => {
    const container = mount(() => h(AGUISelect, { label: 'Theme', modelValue: 'dark', options: ['dark', 'light'], disabled: true }))
    const trigger = container.querySelector<HTMLButtonElement>('[role=combobox]')!
    expect(trigger.getAttribute('aria-label')).toBe('Theme')
    expect(trigger.disabled).toBe(true)
  })

  it('updates selected text when option labels change without changing the selected value', async () => {
    const options = ref([{ value: 'folder', label: '当前目录及子目录' }])
    const update = vi.fn()
    const container = mount(() => h(AGUISelect, { 'label': 'Browse scope', 'modelValue': 'folder', 'options': options.value, 'onUpdate:modelValue': update }))
    const trigger = container.querySelector<HTMLButtonElement>('[role=combobox]')!
    expect(trigger.textContent).toContain('当前目录及子目录')
    options.value = [{ value: 'folder', label: 'Folder and descendants' }]
    await nextTick()
    expect(trigger.textContent).toContain('Folder and descendants')
    expect(trigger.title).toBe('Folder and descendants')
    expect(update).not.toHaveBeenCalled()
  })

  it('connects dialog descriptions and keeps a working close control', async () => {
    const open = ref(true)
    mount(() => h(AGUIDialog, { 'open': open.value, 'title': 'Settings', 'description': 'Project settings', 'onUpdate:open': value => open.value = value }, () => h('p', 'Settings body')))
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
    const dialog = document.querySelector('[role=dialog]')!
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Project settings')
    document.querySelector<HTMLButtonElement>('[aria-label=Close]')!.click()
    await nextTick()
    expect(open.value).toBe(false)
  })

  it('associates property labels and preserves native disclosure and icon button semantics', () => {
    const action = vi.fn()
    const container = mount(() => h(AGUIDetails, { title: 'Transform', open: true }, () => [
      h(AGUIProperty, { label: 'Position', for: 'position' }, () => h(AGUIInput, { id: 'position' })),
      h(AGUIIconButton, { title: 'Reset', disabled: true, onClick: action }),
      h(AGUIIconButton, { title: 'Snap', active: true }),
    ]))
    expect(container.querySelector('details')!.open).toBe(true)
    expect(container.querySelector('summary')!.textContent).toContain('Transform')
    expect(container.querySelector('label')!.control).toBe(container.querySelector('input'))
    const buttons = container.querySelectorAll('button')
    expect(buttons[0].type).toBe('button')
    expect(buttons[0].getAttribute('aria-label')).toBe('Reset')
    expect(buttons[0].hasAttribute('aria-pressed')).toBe(false)
    buttons[0].click()
    expect(action).not.toHaveBeenCalled()
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('names toolbars and supports keyboard navigation and toggle state', async () => {
    const items = ref([
      { type: 'button' as const, title: 'Edit', onClick: vi.fn() },
      { type: 'button' as const, title: 'Export', onClick: vi.fn() },
      { type: 'toggle-group' as const, name: 'View', value: 'list', children: [
        { value: 'list', label: 'List', icon: 'list', onClick: vi.fn() },
        { value: 'grid', label: 'Grid', icon: 'grid', onClick: vi.fn() },
      ] },
    ])
    const container = mount(() => h(AGUIToolbar, { label: 'Character tools', items: items.value }))
    expect(container.querySelector('[role=toolbar]')!.getAttribute('aria-label')).toBe('Character tools')
    const buttons = container.querySelectorAll('button')
    await nextTick()
    buttons[0].focus()
    await nextTick()
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[1]))
    buttons[3].click()
    await nextTick()
    expect(buttons[3].getAttribute('aria-pressed')).toBe('true')
    expect(buttons[2].getAttribute('aria-pressed')).toBe('false')
  })
})
