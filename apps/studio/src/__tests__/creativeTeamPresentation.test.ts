import { createCreativeBootstrapPlan, createCreativeTeamRun, parseCreativeTeamStartRequest } from '@advjs/agent'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import CreativePartnerRoster from '../components/creative-team/CreativePartnerRoster.vue'
import CreativeTeamOutput from '../components/creative-team/CreativeTeamOutput.vue'
import CreativeTeamRequestForm from '../components/creative-team/CreativeTeamRequestForm.vue'
import CreativeTeamRunPanel from '../components/creative-team/CreativeTeamRunPanel.vue'
import { creativeTeamMessages } from '../i18n/locales/creativeTeam'

function options() {
  return { global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } })], stubs: { IonIcon: true, RouterLink: { template: '<a><slot /></a>' } } } }
}
describe('creative partner presentation', () => {
  it('offers bounded rework for a stale task even when none of its old candidates can be selected', async () => {
    const request = parseCreativeTeamStartRequest({ protocolVersion: 1, project: { id: 'station', revision: 'r1', files: {} }, goal: '改写开场', partner: 'writer', locale: 'zh-CN', limits: { maxTasks: 4, maxToolCalls: 8, maxReworkRounds: 2, maxMicroPoints: 1000 } })
    const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: createCreativeBootstrapPlan(request), now: 1 })
    run.status = 'blocked'
    run.tasks = run.tasks.map(task => ({ ...task, status: 'stale', attempt: 1 }))
    const wrapper = mount(CreativeTeamRunPanel, { ...options(), props: { run, busy: false, enabled: true, authorEditsAvailable: true } })
    const form = wrapper.get('[data-testid="creative-task-rework"]')
    await form.get('textarea').setValue('根据新版人物动机重写对白')
    await form.trigger('submit')
    expect(wrapper.emitted('decide')![0][0]).toEqual({ type: 'request-rework', taskId: 'initial', reason: '根据新版人物动机重写对白' })
    expect(form.text()).toContain('最多 3 次')
  })
  it('exposes six keyboard buttons, actual role duties and explicit unavailable status', () => {
    const wrapper = mount(CreativePartnerRoster, { ...options(), props: { selected: 'director' } })
    expect(wrapper.findAll('button')).toHaveLength(6)
    expect(wrapper.get('button[aria-pressed="true"]').text()).toContain('导演')
    expect(wrapper.text()).toContain('此伙伴的托管能力尚未开放')
    expect(wrapper.text()).toContain('人物档案、关系与语言风格')
  })
  it('keeps submission unavailable when the service is disabled, even with valid fields', async () => {
    const wrapper = mount(CreativeTeamRequestForm, { ...options(), props: { partner: 'director', disabled: true, busy: false } })
    await wrapper.get('textarea').setValue('雨夜车站长中文目标')
    await wrapper.get('input').setValue('20')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('未保存的内容不会发送')
  })
  it('labels model playtest plans as unexecuted and media plans as handoffs', () => {
    const testPlan = mount(CreativeTeamOutput, { ...options(), props: { output: { kind: 'playtest-plan', summary: '方案', scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending' }], concerns: [] } } })
    expect(testPlan.text()).toContain('尚无实际执行轨迹')
    const art = mount(CreativeTeamOutput, { ...options(), props: { output: { kind: 'art-direction', summary: '方案', style: '雨夜', requests: [] } } })
    expect(art.text()).toContain('尚未绑定可用图片')
    expect(art.text()).not.toContain('生成成功')
  })
})
