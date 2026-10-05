import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, shallowRef } from 'vue'
import AdvContainer from '../../packages/client/components/internals/AdvContainer.vue'

const width = shallowRef(390)
const height = shallowRef(844)
const portraitPhone = shallowRef(true)
const app = reactive({ rotation: 0, isHorizontal: true, transition: false })
vi.mock('../../packages/client/stores', () => ({ useAppStore: () => app }))
vi.mock('@vueuse/core', async importOriginal => ({
  ...await importOriginal<typeof import('@vueuse/core')>(),
  useElementSize: () => ({ width, height }),
  useMediaQuery: () => portraitPhone,
}))
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  width.value = 390
  height.value = 844
  portraitPhone.value = true
})

it('rotates scene and controls together and preserves state when the phone turns', async () => {
  const statefulScene = defineComponent({
    setup() {
      const line = shallowRef(1)
      return () => h('button', { onClick: () => line.value++ }, `Line ${line.value}`)
    },
  })
  const wrapper = mount(AdvContainer, {
    props: { landscape: true },
    slots: { default: statefulScene, controls: '<nav>Settings</nav>' },
  })
  wrappers.push(wrapper)
  expect(wrapper.get('.adv-screen').attributes('style')).toContain('width: 844px')
  expect(wrapper.get('.adv-screen').attributes('style')).toContain('rotate(90deg)')
  expect(wrapper.get('.adv-screen nav').text()).toBe('Settings')
  await wrapper.get('button').trigger('click')
  width.value = 844
  height.value = 390
  portraitPhone.value = false
  await nextTick()
  expect(wrapper.get('.adv-screen').classes()).not.toContain('is-landscape-phone')
  expect(wrapper.get('button').text()).toBe('Line 2')
  portraitPhone.value = true
  width.value = 390
  height.value = 844
  await nextTick()
  expect(wrapper.get('button').text()).toBe('Line 2')
})

it('keeps a narrow desktop preview and an opted-out portrait game upright', async () => {
  portraitPhone.value = false
  const wrapper = mount(AdvContainer, { props: { landscape: true } })
  wrappers.push(wrapper)
  expect(wrapper.get('.adv-screen').classes()).not.toContain('is-landscape-phone')
  portraitPhone.value = true
  await wrapper.setProps({ landscape: false })
  expect(wrapper.get('.adv-screen').classes()).not.toContain('is-landscape-phone')
})
