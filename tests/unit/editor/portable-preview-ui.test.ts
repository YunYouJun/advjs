import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import { AdvPreviewPlayer, AdvPreviewTrace, AdvVariableInspector, useAuthoringPreview } from '../../../packages/gui/authoring'

function createHost(initial = 0) {
  let count = initial
  return { inspect: () => ({ count }), dispatch: vi.fn(async (delta: number) => {
    count += delta
  }), back: vi.fn(async () => {
    count--
  }) }
}
describe('portable authoring preview', () => {
  it('isolates source revisions, gates concurrent inputs, and recovers from failed host operations', async () => {
    const source = shallowRef({ initial: 1 })
    const invalid = shallowRef(false)
    const host = createHost(1)
    const create = vi.fn(() => host)
    const preview = useAuthoringPreview(source, invalid, { revision: JSON.stringify, create })
    await preview.start()
    let release!: () => void
    host.dispatch.mockImplementationOnce(() => new Promise((resolve) => {
      release = resolve
    }))
    const pending = preview.dispatch(2)
    expect(preview.busy.value).toBe(true)
    await preview.dispatch(20)
    await preview.start()
    expect(host.dispatch).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    release()
    await pending
    source.value = { initial: 8 }
    expect(preview.stale.value).toBe(true)
    await preview.back()
    expect(host.back).not.toHaveBeenCalled()
    await preview.start()
    expect(preview.stale.value).toBe(false)
    host.dispatch.mockRejectedValueOnce(new Error('Rejected by host'))
    await preview.dispatch(1)
    expect(preview.error.value).toBe('Rejected by host')
    expect(preview.busy.value).toBe(false)
    await preview.dispatch(3)
    expect(preview.error.value).toBe('')
    expect(preview.view.value).toEqual({ count: 4 })
    invalid.value = true
    await preview.start()
    await preview.dispatch(99)
    expect(preview.view.value).toEqual({ count: 4 })
  })

  it('retains a working run on failed restart, marks async creation stale, and ignores disposed results', async () => {
    const source = shallowRef(0)
    const invalid = shallowRef(false)
    let resolve!: (host: ReturnType<typeof createHost>) => void
    let fail = false
    const scope = effectScope()
    const preview = scope.run(() => useAuthoringPreview(source, invalid, {
      revision: String,
      create: () => {
        if (fail)
          throw new Error('Cannot create')
        return new Promise<ReturnType<typeof createHost>>((done) => {
          resolve = done
        })
      },
    }))!
    const pending = preview.start()
    source.value = 1
    resolve(createHost(2))
    await pending
    expect(preview.stale.value).toBe(true)
    fail = true
    await preview.start()
    expect(preview.view.value).toEqual({ count: 2 })
    expect(preview.error.value).toBe('Cannot create')
    fail = false
    const next = preview.start()
    scope.stop()
    resolve(createHost(100))
    await next
    expect(preview.view.value).toEqual({ count: 2 })
  })

  it('reports inspection failures and releases the busy guard', async () => {
    const host = createHost()
    const preview = useAuthoringPreview(shallowRef(0), shallowRef(false), { revision: String, create: () => host })
    await preview.start()
    host.inspect = () => {
      throw new Error('Inspection failed')
    }
    await preview.dispatch(1)
    expect(preview.busy.value).toBe(false)
    expect(preview.error.value).toBe('Inspection failed')
  })

  it('distinguishes optional false, zero, null and unset; blocks invalid numeric and readonly edits', async () => {
    const wrapper = mount(AdvVariableInspector, { props: { groups: [{ id: 'debug', label: 'Debug', variables: [
      { id: 'optional', label: 'Optional', type: 'boolean', optional: true, value: undefined },
      { id: 'enum', label: 'Enum', type: 'string', optional: true, value: null, options: [{ value: null, label: 'Null' }, { value: 0, label: 'Zero' }, { value: false, label: 'False' }] },
      { id: 'number', label: 'Number', type: 'number', min: 0, value: 2 },
      { id: 'string', label: 'String', type: 'string', optional: true, value: '' },
      { id: 'fact', label: 'Fact', type: 'boolean', readonly: true, value: true },
    ] }] } })
    await wrapper.get('[data-preview-variable="optional"] select').setValue('0')
    await wrapper.get('[data-preview-variable="enum"] select').setValue('1')
    await wrapper.get('[data-preview-variable="enum"] select').setValue('0')
    await wrapper.get('[data-preview-variable="enum"] select').setValue('')
    expect(wrapper.emitted('change')).toEqual([['optional', false], ['enum', 0], ['enum', null], ['enum', undefined]])
    const input = wrapper.get('[data-preview-variable="number"] input')
    await input.setValue('')
    await input.setValue('-1')
    expect((input.element as HTMLInputElement).value).toBe('-1')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('change')).toHaveLength(4)
    await input.setValue('0')
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['number', 0])
    await wrapper.get('[data-preview-variable="string"] button').trigger('click')
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['string', undefined])
    expect(wrapper.find('[data-preview-variable="fact"] input').exists()).toBe(false)
    await wrapper.setProps({ disabled: true })
    await wrapper.get('[data-preview-variable="enum"] select').setValue('1')
    expect(wrapper.emitted('change')).toHaveLength(6)
    wrapper.unmount()
  })

  it('plays host-provided dialogue, refreshes choices and gates commands even through custom slots', async () => {
    const dialogue = { node: 'start', speaker: 'Host character', text: '<script>source text</script>', choices: [{ id: 'a', label: 'A' }], hiddenChoices: 2, canContinue: true, canClose: true }
    const wrapper = mount(AdvPreviewPlayer, { props: { dialogue }, slots: { button: '<button @click="params.activate()">{{ params.action }} {{ params.label }}</button>' } })
    expect(wrapper.find('script').exists()).toBe(false)
    await wrapper.get('.choice-list button').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['a']])
    await wrapper.setProps({ disabled: true })
    await wrapper.get('.player-actions button').trigger('click')
    expect(wrapper.emitted('next')).toBeUndefined()
    await wrapper.setProps({ disabled: false, dialogue: { ...dialogue, choices: [], canContinue: false } })
    expect(wrapper.find('.choice-list button').exists()).toBe(false)
    await wrapper.get('.player-heading button').trigger('click')
    expect(wrapper.emitted('locate')).toEqual([['start']])
    wrapper.unmount()
  })

  it('bounds trace rendering independently of replay, keeps state changes and locates host cursors', async () => {
    const entries = Array.from({ length: 260 }, (_, index) => ({ sequence: index + 1, label: `Input ${index + 1}`, messages: ['Message'], changes: [{ key: 'ready', before: undefined, after: false }] }))
    const cursor = { id: 'main', label: 'Main track', node: 'stable-id', active: true }
    const wrapper = mount(AdvPreviewTrace, { props: { entries, steps: 260, cursors: [cursor] } })
    expect(wrapper.findAll('li')).toHaveLength(200)
    expect(wrapper.get('li').attributes('data-trace-sequence')).toBe('260')
    expect(wrapper.text()).toContain('Unset → false')
    expect(entries[0]?.sequence).toBe(1)
    await wrapper.get('.cursors button').trigger('click')
    expect(wrapper.emitted('locate')).toEqual([[cursor]])
    await wrapper.setProps({ disabled: true, entries: entries.slice(0, 1), steps: 1 })
    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Showing the latest')
    await wrapper.get('.cursors button').trigger('click')
    expect(wrapper.emitted('locate')).toHaveLength(1)
    wrapper.unmount()
  })
})
