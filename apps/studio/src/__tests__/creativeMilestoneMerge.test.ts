import type { CreativeArtifact } from '@advjs/agent'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import CreativeMilestoneMerge from '../components/creative-team/CreativeMilestoneMerge.vue'
import { useCreativeMilestoneMerge } from '../composables/useCreativeMilestoneMerge'
import { creativeTeamMessages } from '../i18n/locales/creativeTeam'

const conflict = { path: 'adv/chapters/intro.adv.md', before: '原始内容', editable: true, contributions: [{ artifactId: 'a', summary: '候选甲', after: '等待' }, { artifactId: 'b', summary: '候选乙', after: null }] }
const i18n = () => createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } })
describe('local milestone merge drafts', () => {
  it('requires explicit approval of each exact input and resets approval on edits or changed fingerprints', () => {
    const inputs = shallowRef(conflict.contributions.map(item => ({ id: item.artifactId, runId: 'run', taskId: 'writer', partner: 'writer', projectId: 'station', status: 'selected', source: { projectId: 'station', revision: 'r1', files: {}, upstream: [] }, reviewCapabilities: ['modify-source', 'candidate-preview'], summary: item.summary, fingerprint: 'v1', kind: 'chapter', changes: [{ path: conflict.path, before: conflict.before, after: item.after }] })) as CreativeArtifact[])
    const scope = effectScope()
    const merge = scope.run(() => useCreativeMilestoneMerge(inputs))!
    expect(merge.complete.value).toBe(false)
    merge.update(conflict.path, '等待并归还信件', true)
    expect(merge.complete.value).toBe(true)
    expect(merge.resolutions.value).toEqual([{ path: conflict.path, after: '等待并归还信件' }])
    merge.update(conflict.path, '再次修改')
    expect(merge.complete.value).toBe(false)
    merge.update(conflict.path, null, true)
    expect(merge.resolutions.value[0]!.after).toBeNull()
    inputs.value = inputs.value.map(item => ({ ...item, fingerprint: 'v2' }))
    expect(merge.complete.value).toBe(false)
    expect(merge.drafts.value).toEqual({})
    scope.stop()
  })

  it('displays actual contributions, keeps deletion distinct from empty text and does not mutate props', async () => {
    const wrapper = mount(CreativeMilestoneMerge, { props: { conflict, disabled: false }, global: { plugins: [i18n()] } })
    expect(wrapper.text()).toContain(conflict.before)
    expect(wrapper.findAll('summary').map(item => item.text())).toEqual(['写入前', '候选甲', '候选乙'])
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update')![0]).toEqual(['等待', false])
    await wrapper.setProps({ draft: { after: '综合修改', confirmed: false } })
    await wrapper.get('textarea').setValue('新的作者文字')
    expect(wrapper.emitted('update')!.at(-1)).toEqual(['新的作者文字', false])
    await wrapper.setProps({ draft: { after: null, confirmed: false } })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).disabled).toBe(true)
    await wrapper.findAll('input')[1]!.setValue(true)
    expect(wrapper.emitted('update')!.at(-1)).toEqual([null, true])
    expect(conflict.contributions[0]!.after).toBe('等待')
  })

  it('shows unsupported dedicated record conflicts without an editor', () => {
    const wrapper = mount(CreativeMilestoneMerge, { props: { conflict: { ...conflict, editable: false }, disabled: false }, global: { plugins: [i18n()] } })
    expect(wrapper.get('[role="status"]').text()).toContain('专用媒体')
    expect(wrapper.find('textarea').exists()).toBe(false)
  })
})
