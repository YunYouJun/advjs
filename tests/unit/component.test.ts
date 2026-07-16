import type { RuntimePendingActivity } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import GenericActivityDebug from '../../packages/client/components/adv/activity/GenericActivityDebug.vue'
import AdvActivity from '../../packages/client/components/adv/AdvActivity.vue'
import { injectionAdvContext } from '../../packages/client/constants'
import TheCounter from '../../playground/src/components/TheCounter.vue'

vi.mock('../../packages/client/env', () => ({ isDev: false }))

describe('component TheCounter.vue', () => {
  it('should render', () => {
    const wrapper = mount(TheCounter, { props: { initial: 10 } })
    expect(wrapper.text()).toContain('10')
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should be interactive', async () => {
    const wrapper = mount(TheCounter, { props: { initial: 0 } })
    expect(wrapper.text()).toContain('0')

    expect(wrapper.find('.inc').exists()).toBe(true)

    expect(wrapper.find('.dec').exists()).toBe(true)

    await wrapper.get('.inc').trigger('click')

    expect(wrapper.text()).toContain('1')

    await wrapper.get('.dec').trigger('click')

    expect(wrapper.text()).toContain('0')
  })
})

describe('component AdvActivity.vue', () => {
  const pending: RuntimePendingActivity = {
    id: 'activity-1',
    type: 'test/open',
    input: { prompt: 'Open it?' },
    node: { chapterId: 'chapter-1', nodeId: 'activity' },
  }

  function context(renderer?: ReturnType<typeof defineComponent>) {
    return {
      store: { state: { pendingActivity: pending } },
      activityRenderers: { resolve: () => renderer },
      runtime: {
        completeActivity: vi.fn(async () => undefined),
        back: vi.fn(),
      },
    }
  }

  it('renders a registered activity and completes with its JSON result', async () => {
    const renderer = defineComponent({
      props: { activity: { type: Object, required: true } },
      emits: ['complete', 'back'],
      template: '<button class="complete" @click="$emit(\'complete\', { ok: true })">{{ activity.type }}</button>',
    })
    const $adv = context(renderer)
    const wrapper = mount(AdvActivity, {
      global: { provide: { [injectionAdvContext as unknown as string]: $adv } },
    })

    expect(wrapper.text()).toContain('test/open')
    await wrapper.get('.complete').trigger('click')
    await flushPromises()
    expect($adv.runtime.completeActivity).toHaveBeenCalledWith({ ok: true })
  })

  it('keeps an unsupported production activity pending and allows back', async () => {
    const $adv = context()
    const wrapper = mount(AdvActivity, {
      global: { provide: { [injectionAdvContext as unknown as string]: $adv } },
    })

    expect(wrapper.text()).toContain('当前版本不支持此互动')
    expect($adv.runtime.completeActivity).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    expect($adv.runtime.back).toHaveBeenCalledOnce()
  })

  it('submits valid JSON from the generic debug renderer', async () => {
    const wrapper = mount(GenericActivityDebug, { props: { activity: pending } })
    await wrapper.get('textarea').setValue('{"score":0.9}')
    const submit = wrapper.findAll('button').find(button => button.text() === '提交 JSON')
    await submit!.trigger('click')

    expect(wrapper.emitted('complete')).toEqual([[{ score: 0.9 }]])
  })
})
