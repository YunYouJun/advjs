import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseRuntimeExpression } from '../../../packages/core/src/runtime/expression'
import { AdvConditionInspector, AdvDiagnosticsPanel, AdvFlowCanvas, createJsonConditionAdapter } from '../../../packages/gui/authoring'

const wrappers: { unmount: () => void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('portable authoring Vue controls', () => {
  it('keeps incomplete JSON distinct from source, refreshes semantic references and handles optional clearing', async () => {
    const adapter = createJsonConditionAdapter({ validate: value => (value as any)?.var === 'missing' ? [{ code: 'UNKNOWN', severity: 'error', message: 'Unknown variable' }] : [], references: [{ name: 'ready' }] })
    const wrapper = mount(AdvConditionInspector, { props: { label: 'Condition', value: true, adapter, optional: true } })
    wrappers.push(wrapper)
    await wrapper.get('textarea').setValue('{')
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('invalid')?.at(-1)).toEqual(['{'])
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    await wrapper.get('textarea').setValue('{"var":"missing"}')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ var: 'missing' }])
    expect(wrapper.text()).toContain('Unknown variable')
    await wrapper.setProps({ value: { var: 'missing' }, draft: '{' })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('{')
    await wrapper.setProps({ value: false, draft: undefined })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('false')
    await wrapper.get('textarea').setValue('')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([undefined])
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('textarea').attributes()).toHaveProperty('disabled')
  })

  it('accepts an ADV expression adapter without changing its source format or executing code', async () => {
    const wrapper = mount(AdvConditionInspector, { props: {
      label: 'Native condition',
      value: 'ready == true',
      adapter: { format: value => String(value ?? ''), parse: (text) => {
        parseRuntimeExpression(text)
        return text
      } },
    } })
    wrappers.push(wrapper)
    await wrapper.get('textarea').setValue('ready && count > 2')
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['ready && count > 2'])
    await wrapper.get('textarea').setValue('globalThis.alert("bad")')
    expect(wrapper.emitted('change')).toHaveLength(1)
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
  })

  it('paginates all diagnostics, preserves domain fields when navigating and resets on new input', async () => {
    const diagnostics = Array.from({ length: 83 }, (_, index) => ({ code: `D${index}`, severity: 'error' as const, path: `chapter/${index}`, message: `Issue ${index}`, domain: index }))
    const wrapper = mount(AdvDiagnosticsPanel, { props: { diagnostics, pageSize: 80 } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('li')).toHaveLength(80)
    await wrapper.get('nav button:last-child').trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(3)
    await wrapper.get('[data-source-path="chapter/82"]').trigger('click')
    expect(wrapper.emitted('navigate')?.at(-1)?.[0]).toEqual(diagnostics[82])
    await wrapper.setProps({ disabled: true })
    await wrapper.get('[data-source-path="chapter/82"]').trigger('click')
    expect(wrapper.emitted('navigate')).toHaveLength(1)
    await wrapper.setProps({ diagnostics: diagnostics.slice(0, 1), disabled: false })
    expect(wrapper.text()).toContain('Issue 0')
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('isolates SVG markers and preserves node selection, zoom bounds, keyboard panning and resize cleanup', async () => {
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect })
    const graph = { id: 'demo', entry: 'a', width: 400, height: 200, nodes: [{ id: 'a', title: 'A', text: 'Text', x: 20, y: 20 }], edges: [{ id: 'loop', from: 'a', to: 'a', label: 'Repeat', conditional: true }] }
    const first = mount(AdvFlowCanvas, { props: { graph, selected: 'a' }, global: { config: { idPrefix: 'first' } } })
    const second = mount(AdvFlowCanvas, { props: { graph, selected: 'a' }, global: { config: { idPrefix: 'second' } } })
    wrappers.push(first, second)
    expect(first.get('marker').attributes('id')).not.toBe(second.get('marker').attributes('id'))
    expect(first.get('path.edge').attributes('d')).toContain(' L ')
    await first.get('[data-node-id="a"]').trigger('click')
    expect(first.emitted('select')).toEqual([['a']])
    const before = first.get('.graph-plane').attributes('style')
    await first.get('.viewport').trigger('keydown', { key: 'ArrowRight' })
    expect(first.get('.graph-plane').attributes('style')).not.toBe(before)
    for (let index = 0; index < 40; index++) await first.get('[aria-label="Zoom in"]').trigger('click')
    expect(first.text()).toContain('150%')
    expect(first.get('button.story-node').attributes('aria-pressed')).toBe('true')
    first.unmount()
    wrappers.shift()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
