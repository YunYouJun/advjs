import type { CreativeArtifact, CreativeEditableOutput } from '@advjs/agent'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import CreativeCandidateEditor from '../components/creative-team/CreativeCandidateEditor.vue'
import CreativeTeamArtifactCard from '../components/creative-team/CreativeTeamArtifactCard.vue'
import { creativeTeamMessages } from '../i18n/locales/creativeTeam'

function options() {
  return { global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } })] } }
}
const characters: Extract<CreativeEditableOutput, { kind: 'characters' }> = { kind: 'characters', summary: '两位人物', characters: [{ id: 'lin', name: '林舟', description: '职员', motivation: '归还信', speakingStyle: '短句', visualConstraints: [], voiceConstraints: [], relationships: [{ targetId: 'qiao', type: '陌生人', description: '初次相遇' }] }, { id: 'qiao', name: '乔雨', description: '旅客', motivation: '找姐姐', speakingStyle: '克制', visualConstraints: [], voiceConstraints: [], relationships: [] }] }

describe('author candidate editor', () => {
  it('prepares actual speech identities only in the draft, preserves them on repeat and saves a separate revision', async () => {
    const content = '@lin\n列车还没有到，\n我们再**等一会儿**。\n\n> 雨停了。'
    const output: CreativeEditableOutput = { kind: 'chapter', summary: '待配音章节', chapters: [{ id: 'station', title: '车站', content }], entryChapterId: 'station', endingAddresses: ['station#end'] }
    const wrapper = mount(CreativeCandidateEditor, { ...options(), props: { output, candidateId: 'chapter', busy: false } })
    const prepare = () => wrapper.findAll('button').find(button => button.text() === '补齐台词身份')!.trigger('click')
    await prepare()
    await flushPromises()
    const prepared = (wrapper.get('#chapter-station-content').element as HTMLTextAreaElement).value
    expect(prepared.match(/\{#line_[^}]+\}/g)).toHaveLength(2)
    expect(wrapper.get('[role="status"]').text()).toContain('已补齐 2 处，保留 0 处')
    expect(output.chapters[0].content).toBe(content)
    expect(wrapper.emitted('save')).toBeUndefined()
    await prepare()
    await flushPromises()
    expect((wrapper.get('#chapter-station-content').element as HTMLTextAreaElement).value).toBe(prepared)
    expect(wrapper.get('[role="status"]').text()).toContain('已补齐 0 处，保留 2 处')
    await wrapper.get('#chapter-reason').setValue('为已审阅对白建立配音交接身份')
    await wrapper.get('form').trigger('submit')
    expect((wrapper.emitted('save')![0]![0] as { output: typeof output }).output.chapters[0].content).toBe(prepared)
    await wrapper.get('#chapter-station-content').setValue(prepared.replace('雨停了', '雨又下了'))
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('retains the draft and shows an actionable failure for duplicate identities', async () => {
    const content = '@lin\n甲。 {#line_01900400-0000-7000-8000-000000000001}\n\n> 乙。 {#line_01900400-0000-7000-8000-000000000001}'
    const output: CreativeEditableOutput = { kind: 'chapter', summary: '冲突', chapters: [{ id: 'station', title: '车站', content }], entryChapterId: 'station', endingAddresses: ['station#end'] }
    const wrapper = mount(CreativeCandidateEditor, { ...options(), props: { output, candidateId: 'chapter', busy: false } })
    await wrapper.findAll('button').find(button => button.text() === '补齐台词身份')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('重复身份')
    expect((wrapper.get('#chapter-station-content').element as HTMLTextAreaElement).value).toBe(content)
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.setProps({ disabled: true })
    expect(wrapper.findAll('button').find(button => button.text() === '补齐台词身份')!.attributes('disabled')).toBeDefined()
  })

  it('keeps unsaved typing after an unconfirmed save is discovered through a later read', async () => {
    const artifact: CreativeArtifact = { id: 'people', runId: 'run1', taskId: 'cast', partner: 'character-designer', projectId: 'station', kind: 'characters', source: { projectId: 'station', revision: 'r1', files: {}, upstream: [] }, fingerprint: 'f1', summary: characters.summary, output: characters, changes: [], reviewCapabilities: [], status: 'candidate' }
    const wrapper = mount(CreativeTeamArtifactCard, { ...options(), props: { artifact, busy: false, canSelect: true, canRework: false, canEdit: true } })
    await wrapper.get('button').trigger('click')
    await wrapper.get('#people-lin-motivation').setValue('保存结果不明后，作者仍在继续写的新内容')
    await wrapper.findAll('button').find(button => button.text() === '收起编辑')!.trigger('click')
    await wrapper.setProps({ artifact: { ...artifact, status: 'stale' }, canEdit: false, canSelect: false })
    await wrapper.findAll('button').find(button => button.text() === '查看保留的编辑草稿')!.trigger('click')
    expect((wrapper.get('#people-lin-motivation').element as HTMLTextAreaElement).value).toContain('作者仍在继续写')
    await wrapper.setProps({ editSaved: true })
    expect(wrapper.find('[data-testid="creative-candidate-editor"]').exists()).toBe(false)
  })
  it('edits cast and relationships locally, then emits a version with the author reason', async () => {
    const wrapper = mount(CreativeCandidateEditor, { ...options(), props: { output: characters, candidateId: 'people', busy: false } })
    await wrapper.get('#people-lin-motivation').setValue('先找到失主，再决定是否归还信')
    await wrapper.get('#people-lin-relation-0').setValue('共同调查者')
    await wrapper.get('#people-reason').setValue('让人物更主动')
    expect(characters.characters[0].motivation).toBe('归还信')
    expect(wrapper.text()).toContain('不重新调用模型')
    await wrapper.get('form').trigger('submit')
    const saved = wrapper.emitted('save')![0][0] as { output: typeof characters, reason: string }
    expect(saved.reason).toBe('让人物更主动')
    expect(saved.output.characters[0]).toMatchObject({ id: 'lin', motivation: '先找到失主，再决定是否归还信', relationships: [{ targetId: 'qiao', type: '共同调查者' }] })
    expect(() => structuredClone(saved)).not.toThrow()
  })

  it('keeps a changed chapter draft available when its source becomes stale, with submission disabled', async () => {
    const output: CreativeEditableOutput = { kind: 'chapter', summary: '双结局', entryChapterId: 'station', endingAddresses: ['stay#end', 'leave#end'], chapters: [{ id: 'station', title: '雨夜车站', content: '# 开始 {#start}\n\n旧对白。' }] }
    const wrapper = mount(CreativeCandidateEditor, { ...options(), props: { output, candidateId: 'chapter', busy: false } })
    await wrapper.get('#chapter-station-content').setValue('# 开始 {#start}\n\n作者改写的对白。')
    await wrapper.get('#chapter-reason').setValue('调整对白')
    await wrapper.setProps({ disabled: true })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect((wrapper.get('#chapter-station-content').element as HTMLTextAreaElement).value).toContain('作者改写')
    expect(wrapper.text()).toContain('草稿保留供复制')
    expect(output.chapters[0].content).toContain('旧对白')
  })
})
