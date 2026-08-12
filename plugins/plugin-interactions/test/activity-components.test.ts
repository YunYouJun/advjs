import type { RuntimePendingActivity } from '@advjs/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CivilizationActivity from '../client/CivilizationActivity.vue'
import StarMapActivity from '../client/StarMapActivity.vue'

function activity(type: string, input: RuntimePendingActivity['input']): RuntimePendingActivity {
  return {
    id: `${type}-1`,
    type,
    input,
    node: { chapterId: 'chapter-1', nodeId: 'activity' },
  }
}

describe('interaction activity components', () => {
  it('emits a clamped star-map match result', async () => {
    const wrapper = mount(StarMapActivity, {
      props: { activity: activity('star-map/compare', { tolerance: 0.82 }) },
    })

    await wrapper.get('[data-testid="rotation"]').setValue('0')
    await wrapper.get('[data-testid="scale"]').setValue('1')
    const confirm = wrapper.findAll('button').find(button => button.text() === '确认轨迹')
    await confirm!.trigger('click')

    expect(wrapper.emitted('complete')).toEqual([[
      { matched: true, score: 1 },
    ]])
  })

  it('emits civilization name, level, and principle', async () => {
    const wrapper = mount(CivilizationActivity, {
      props: {
        activity: activity('civilization/initialize', {
          suggestedName: '种子',
          principles: ['memory', 'curiosity'],
          defaultLevel: 1,
        }),
      },
    })

    await wrapper.get('input[type="text"]').setValue('仓生')
    await wrapper.get('input[type="number"]').setValue('2')
    const memory = wrapper.findAll('button').find(button => button.text().includes('memory'))
    await memory!.trigger('click')
    await wrapper.get('button[type="submit"]').trigger('submit')

    expect(wrapper.emitted('complete')).toEqual([[
      { name: '仓生', level: 2, principle: 'memory' },
    ]])
  })
})
