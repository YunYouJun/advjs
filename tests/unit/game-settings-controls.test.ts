import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdvSelect from '../../themes/theme-default/components/ui/AdvSelect.vue'
import AdvSlider from '../../themes/theme-default/components/ui/AdvSlider.vue'
import { mockResizeObserver } from '../helpers/resize-observer'

beforeEach(mockResizeObserver)
afterEach(() => vi.unstubAllGlobals())

describe('game settings controls', () => {
  it('returns the selected option without mutating its controlled props', async () => {
    const change = vi.fn()
    const options = [{ label: '普通话', value: 'zh-CN' }, { label: '粤语', value: 'zh-HK' }]
    const props = { selected: 'zh-CN', options, change }
    const wrapper = mount(AdvSelect, { props: { props }, attrs: { 'aria-label': '语音语言' } })
    await wrapper.get('select').setValue('zh-HK')
    expect(change).toHaveBeenCalledWith(options[1])
    expect(props.selected).toBe('zh-CN')
    wrapper.unmount()
  })

  it('accepts numeric volume edits, keeps range limits and ignores an empty draft', async () => {
    const wrapper = mount(AdvSlider, { props: { modelValue: 0.5, label: '音量', min: 0, max: 1, step: 0.05 } })
    const input = wrapper.get('input[type="number"]')
    await input.setValue('0.75')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0.75])
    await input.setValue('2')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1])
    await input.setValue('')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(2)
    wrapper.unmount()
  })
})
