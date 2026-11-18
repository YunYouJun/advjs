import type { CreativeTeamRun, CreativeTextEditOutput } from '@advjs/agent'
import { createCreativeTeamRun } from '@advjs/agent'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import CreativeSourceCandidateEditor from '../components/creative-team/CreativeSourceCandidateEditor.vue'
import CreativeTeamRunPanel from '../components/creative-team/CreativeTeamRunPanel.vue'
import { creativeTeamMessages } from '../i18n/locales/creativeTeam'

function options() {
  return { global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } })] } }
}
const output: CreativeTextEditOutput = { kind: 'source-text', summary: '旧章节文字候选', content: '# 车站 {#arrival}\r\n\r\n@lin\r\n等一下。\r\n\r\n> 车灯亮了。\r\n' }
const props = { output, path: 'adv/chapters/station.adv.md', candidateId: 'old-chapter', busy: false, disabled: false }
function legacyRun(): CreativeTeamRun {
  const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', now: 1, plan: { protocolVersion: 1, projectId: 'station', projectRevision: 'r1', goal: '旧章节候选', limits: { maxTasks: 1, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [{ id: 'script', partner: 'writer', capability: 'generate-chapter-draft', dependsOn: [], sourcePaths: ['adv/world.md'], instruction: '章节正文', expectedOutput: '文字候选' }] } })
  run.status = 'awaiting_review'
  run.tasks = [{ ...run.tasks[0]!, status: 'awaiting_review', artifactIds: ['old-chapter'], attempt: 1 }]
  run.artifacts = [{ id: 'old-chapter', runId: run.id, taskId: 'script', projectId: 'station', partner: 'writer', kind: 'chapter', fingerprint: 'fp1', summary: output.summary, status: 'candidate', source: { projectId: 'station', revision: 'r1', files: { 'adv/world.md': '世界设定' }, upstream: [] }, changes: [{ path: props.path, before: null, after: output.content }], reviewCapabilities: ['create-source', 'candidate-preview'] }]
  return run
}

describe('fixed legacy source candidate editor', () => {
  it('keeps the target read-only and emits only author text and a reason without changing the input', async () => {
    const wrapper = mount(CreativeSourceCandidateEditor, { ...options(), props })
    expect(wrapper.text()).toContain(props.path)
    expect(wrapper.find('input[value="adv/chapters/station.adv.md"]').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get(`#${props.candidateId}-source-content`).setValue('# 作者的章节\n\n原文保留。\n')
    await wrapper.get(`#${props.candidateId}-source-reason`).setValue('作者明确改写正文')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([{ output: { ...output, content: '# 作者的章节\r\n\r\n原文保留。\r\n' }, reason: '作者明确改写正文' }])
    expect(output.content).toContain('等一下。')
    expect(wrapper.emitted('save')?.[0]?.[0]).not.toHaveProperty('path')
    wrapper.unmount()
  })

  it('prepares actual stable dialogue identities in the local CRLF draft and leaves saving explicit', async () => {
    const wrapper = mount(CreativeSourceCandidateEditor, { ...options(), props })
    const button = wrapper.findAll('button').find(item => item.text() === '补齐台词身份')!
    await button.trigger('click')
    await flushPromises()
    const text = (wrapper.get(`#${props.candidateId}-source-content`).element as HTMLTextAreaElement).value
    expect(text.match(/\{#line_[\w-]+\}/g)).toHaveLength(2)
    expect(wrapper.text()).toContain('已补齐 2 处')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get(`#${props.candidateId}-source-reason`).setValue('补齐真实台词身份用于后续配音')
    await wrapper.get('form').trigger('submit')
    const saved = wrapper.emitted('save')![0]![0] as { output: CreativeTextEditOutput }
    expect(saved.output.content).toContain('\r\n')
    expect(saved.output.content.match(/\{#line_[\w-]+\}/g)).toHaveLength(2)
    expect(output.content).not.toContain('{#line_')
    wrapper.unmount()
  })

  it('retains oversized or stale drafts and refuses submission', async () => {
    const wrapper = mount(CreativeSourceCandidateEditor, { ...options(), props })
    const content = '字'.repeat(17000)
    await wrapper.get(`#${props.candidateId}-source-content`).setValue(content)
    await wrapper.get(`#${props.candidateId}-source-reason`).setValue('先保留长稿')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('草稿保留')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect((wrapper.get(`#${props.candidateId}-source-content`).element as HTMLTextAreaElement).value).toBe(content)
    await wrapper.setProps({ disabled: true })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('来源已变化')
    wrapper.unmount()
  })

  it('negotiates raw text editing independently and retains a closed draft after its source becomes stale', async () => {
    const run = legacyRun()
    const wrapper = mount(CreativeTeamRunPanel, { ...options(), props: { run, busy: false, enabled: true, authorEditsAvailable: true } })
    expect(wrapper.find('[data-edit-candidate]').exists()).toBe(false)
    await wrapper.setProps({ rawTextEditsAvailable: true })
    await wrapper.get('[data-edit-candidate]').trigger('click')
    await wrapper.get('#old-chapter-source-content').setValue('作者尚未保存的独有文字')
    await wrapper.findAll('button').find(item => item.text() === '收起编辑')!.trigger('click')
    await wrapper.get('[data-edit-candidate]').trigger('click')
    expect((wrapper.get('#old-chapter-source-content').element as HTMLTextAreaElement).value).toBe('作者尚未保存的独有文字')
    await wrapper.setProps({ run: { ...run, artifacts: run.artifacts.map(item => ({ ...item, status: 'stale' })), tasks: run.tasks.map(item => ({ ...item, status: 'stale' })) } })
    expect(wrapper.text()).toContain('当前草稿保留供复制')
    expect(wrapper.get('[data-testid="creative-source-candidate-editor"] button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
