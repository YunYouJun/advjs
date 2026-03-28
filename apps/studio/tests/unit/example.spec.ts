import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Tab1Page from '@/views/Tab1Page.vue'

describe('tab1Page.vue', () => {
  it('renders tab 1 Tab1Page', () => {
    const wrapper = mount(Tab1Page)
    expect(wrapper.text()).toMatch('Tab 1 page')
  })
})
