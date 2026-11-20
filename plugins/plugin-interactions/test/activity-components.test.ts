import type { RuntimePendingActivity } from '@advjs/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
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
    const i18n = createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'en' })
    const wrapper = mount(StarMapActivity, {
      props: { activity: activity('star-map/compare', { tolerance: 0.82 }) },
      global: { plugins: [i18n] },
    })

    const rotation = wrapper.get('[data-testid="rotation"]')
    const scale = wrapper.get('[data-testid="scale"]')
    const confirm = wrapper.findAll('button').find(button => button.text() === '确认比对')!
    expect(confirm.attributes()).toHaveProperty('disabled')

    await rotation.setValue('0')
    await scale.setValue('1')
    expect(rotation.attributes('aria-valuetext')).toBe('0°')
    expect((scale.element as HTMLInputElement).value).toBe('1')
    expect(rotation.attributes('style')).toContain('--interaction-range-fill: 50%')
    expect(confirm.attributes()).not.toHaveProperty('disabled')
    i18n.global.locale.value = 'en'
    await nextTick()
    expect(wrapper.get('h2').text()).toBe('Star Map Alignment')
    expect(confirm.text()).toBe('Confirm Alignment')
    expect(rotation.attributes('aria-valuetext')).toBe('0°')
    await confirm.trigger('click')

    expect(wrapper.emitted('complete')).toEqual([[
      { matched: true, score: 1 },
    ]])

    await wrapper.findAll('button').find(button => button.text() === 'Reset Star Map')!.trigger('click')
    expect(rotation.attributes('aria-valuetext')).toBe('-18°')
    expect((scale.element as HTMLInputElement).value).toBe('0.84')
    expect(confirm.attributes()).toHaveProperty('disabled')
  })

  it('emits civilization name, level, and principle', async () => {
    const i18n = createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'en' })
    const wrapper = mount(CivilizationActivity, {
      props: {
        activity: activity('civilization/initialize', {
          suggestedName: '种子',
          principles: ['curiosity', 'memory'],
          defaultLevel: 1,
        }),
      },
      global: { plugins: [i18n] },
    })

    await wrapper.get('input[type="text"]').setValue('仓生')
    await wrapper.get('input[type="number"]').setValue('2')
    const memory = wrapper.findAll('button').find(button => button.text() === '记忆')
    expect(memory?.attributes('aria-pressed')).toBe('false')
    await memory!.trigger('click')
    expect(memory?.attributes('aria-pressed')).toBe('true')
    i18n.global.locale.value = 'en'
    await nextTick()
    expect(wrapper.get('h2').text()).toBe('Civilization Seeding Protocol')
    expect(memory?.text()).toBe('Memory')
    expect(memory?.attributes('aria-pressed')).toBe('true')
    await wrapper.get('button[type="submit"]').trigger('submit')

    expect(wrapper.emitted('complete')).toEqual([[
      { name: '仓生', level: 2, principle: 'memory' },
    ]])
  })
})
