import type { CreativeNarrativeConcern } from '@advjs/agent'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import CreativeNarrativeReport from '../components/creative-team/CreativeNarrativeReport.vue'
import CreativeNarrativeReviewForm from '../components/creative-team/CreativeNarrativeReviewForm.vue'
import { creativeTeamMessages } from '../i18n/locales/creativeTeam'

const concern: CreativeNarrativeConcern = { path: 'adv/chapters/station.adv.md', line: 3, expected: '这个世界没有超能力。', actual: '人物瞬移穿过站台。', suggestion: '交还编剧检查因果。', evidence: { expected: { path: 'adv/world.md', line: 2, endLine: 2, text: '科技水平与当代相同，不存在超能力。' }, actual: { path: 'adv/chapters/station.adv.md', line: 3, endLine: 3, text: '> <script>这是正文字符串</script>' } } }
function options() {
  return { global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } })] } }
}

describe('explicit author narrative judgements', () => {
  it('starts pending, displays escaped quotes, requires a reason and emits immutable decisions', async () => {
    const wrapper = mount(CreativeNarrativeReviewForm, { ...options(), props: { concerns: [concern], decisions: [], disabled: false } })
    expect(wrapper.get('select').element.value).toBe('pending')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('这是正文字符串')
    expect(wrapper.text()).toContain('尚未证明是缺陷')
    expect(wrapper.emitted('update')).toBeUndefined()
    await wrapper.get('select').setValue('confirmed')
    expect(wrapper.emitted('update')?.at(-1)).toEqual([[{ index: 0, status: 'confirmed', reason: '' }]])
    await wrapper.setProps({ decisions: [{ index: 0, status: 'confirmed', reason: '' }] })
    expect(wrapper.get('textarea').attributes('required')).toBeDefined()
    await wrapper.get('textarea').setValue('正文是客观叙述，需要改写。')
    expect(wrapper.emitted('update')?.at(-1)).toEqual([[{ index: 0, status: 'confirmed', reason: '正文是客观叙述，需要改写。' }]])
    expect(wrapper.props('decisions')).toEqual([{ index: 0, status: 'confirmed', reason: '' }])
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('source')).toEqual([['adv/world.md', 2]])
    wrapper.unmount()
  })

  it('keeps unanchored suggestions unverified and does not let disabled forms change decisions', async () => {
    const { evidence: _evidence, ...legacy } = concern
    const wrapper = mount(CreativeNarrativeReviewForm, { ...options(), props: { concerns: [legacy], decisions: [], disabled: false } })
    expect(wrapper.get('option[value="confirmed"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('旧建议没有完整的成对原文依据')
    await wrapper.get('select').setValue('dismissed')
    expect(wrapper.emitted('update')).toHaveLength(1)
    await wrapper.setProps({ disabled: true })
    await wrapper.get('select').setValue('confirmed')
    expect(wrapper.emitted('update')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders frozen judgements, source status and omissions without editing controls', async () => {
    const review = { verification: 'author-source-review' as const, snapshotRevision: `sha256:${'a'.repeat(64)}`, artifactId: 'test-plan', fingerprint: 'plan-v1', rowsOmitted: 2, rows: [{ index: 0, concern, sourceStatus: 'matched' as const, decision: { status: 'dismissed' as const, reason: '这是故意保留的梦境，非客观事实。' } }] }
    const wrapper = mount(CreativeNarrativeReport, { ...options(), props: { review } })
    expect(wrapper.text()).toContain('作者排除本次疑点')
    expect(wrapper.text()).toContain('语义判断来自作者')
    expect(wrapper.text()).toContain('省略 2 项')
    expect(wrapper.text()).toContain('核心路径通过不证明剧情一致')
    expect(wrapper.find('button, input, select, textarea').exists()).toBe(false)
    await wrapper.setProps({ navigable: true })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('source')).toEqual([['adv/world.md', 2]])
    expect(review.rows[0]!.decision.reason).toContain('梦境')
    wrapper.unmount()
  })
})
