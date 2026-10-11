import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import SSelect from '../components/ui/SSelect.vue'

it('updates the current selection label when translated options change without changing its value', async () => {
  const wrapper = mount(SSelect, { attrs: { 'aria-label': 'Filter locale' }, props: { modelValue: 'all', options: [{ value: 'all', label: '全部语言' }, { value: 'zh-CN', label: 'zh-CN' }] } })
  expect(wrapper.get('[role="combobox"]').text()).toBe('全部语言')
  expect(wrapper.get('[role="combobox"]').attributes('aria-label')).toBe('Filter locale')
  await wrapper.setProps({ options: [{ value: 'all', label: 'All languages' }, { value: 'zh-CN', label: 'zh-CN' }] })
  expect(wrapper.get('[role="combobox"]').text()).toBe('All languages')
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  await wrapper.setProps({ modelValue: undefined, placeholder: 'Choose a locale' })
  expect(wrapper.get('[role="combobox"]').text()).toBe('Choose a locale')
  wrapper.unmount()
})
