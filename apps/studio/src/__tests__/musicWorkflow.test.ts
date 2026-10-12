import type { AdvAssetEntry, AdvMusicMetadata } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import { createHash } from 'node:crypto'
import { createMusicMetadata } from '@advjs/audio'
import { applyFlowEdit, parseFlowDocument } from '@advjs/core'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import AudioAssetForm from '../components/audio/AudioAssetForm.vue'
import AudioMusicFields from '../components/audio/AudioMusicFields.vue'
import AudioMusicReview from '../components/audio/AudioMusicReview.vue'
import FlowAudioFields from '../components/flow/FlowAudioFields.vue'
import SSelect from '../components/ui/SSelect.vue'
import zh from '../i18n/locales/zh-CN.json'
import { commitStudioMarkdownMusicBinding, musicAssetQuery, musicFlowEntryCommands, prepareStudioMarkdownMusicBinding } from '../utils/musicWorkflow'
import { createStudioAudioService } from '../utils/projectAudio'

function flowFilesystem() {
  const chapter = { schemaVersion: 1, id: 'intro', title: 'Intro', startNodeId: 'speech', custom: { retained: true }, nodes: [{ id: 'speech', type: 'narration', lineId: 'line_019d137e-7abc-7000-8000-00000000e003', text: 'Before', actorNote: 'Keep', next: 'end' }, { id: 'end', type: 'end' }] }
  const files = new Map([['adv.config.json', JSON.stringify({ id: 'music-flow', format: 'flow', root: 'adv' })], ['adv/assets.json', JSON.stringify({ schemaVersion: 2, id: 'music-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] })], ['adv/chapters/intro.chapter.json', JSON.stringify(chapter)]])
  const fs = { exists: async (path: string) => files.has(path), readFile: async (path: string) => files.get(path)!, collectAllFiles: async () => [...files].map(([path, content]) => ({ path, content })), writeFile: async (path: string, content: string) => {
    files.set(path, content)
  }, deleteFile: async (path: string) => {
    files.delete(path)
  } } as unknown as IFileSystem
  return { files, fs }
}
const bytes = new Uint8Array([1, 2, 3])
const sha256 = createHash('sha256').update(bytes).digest('hex')
const pending = () => createMusicMetadata({ usage: 'theme', source: { type: 'manual' }, brief: { summary: 'Original musical theme' }, rights: { license: 'test-original' } })
function musicAsset(music: AdvMusicMetadata = pending()): AdvAssetEntry {
  return { id: 'audio_019d137e-7abc-7000-8000-00000000e001', type: 'audio', kind: 'bgm', path: 'theme.wav', mimeType: 'audio/wav', sha256, bytes: bytes.length, license: 'test-original', music }
}
function approved() {
  return musicAsset({ ...pending(), review: { status: 'approved', sha256, reviewedAt: '2026-10-12T12:00:00.000Z' } })
}
const i18n = () => createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })
describe('studio native music workflow', () => {
  it('keeps approval explicit, clears confirmation on context changes and blocks pending binding', async () => {
    const asset = musicAsset()
    const wrapper = mount(AudioMusicReview, { props: { asset, active: true, busy: false }, global: { plugins: [i18n()] } })
    const button = (label: string) => wrapper.findAll('button').find(button => button.text() === label)!
    expect(button('审核通过').attributes('disabled')).toBeDefined()
    expect(button('绑定到章节').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(button('审核通过').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ auditioned: true })
    await wrapper.get('input').setValue(true)
    await button('审核通过').trigger('click')
    expect(wrapper.emitted('review')![0]).toEqual(['approved'])
    expect(wrapper.emitted('bind')).toBeUndefined()
    await wrapper.setProps({ asset: approved() })
    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(false)
    await button('绑定到章节').trigger('click')
    expect(wrapper.emitted('bind')).toEqual([[]])
    await wrapper.setProps({ active: false })
    expect(button('绑定到章节').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('preserves unspecified existing intent fields while exporting an editable handoff and rejects private URLs', () => {
    const music = pending()
    const wrapper = mount(AudioMusicFields, { props: { music, license: 'test-original', busy: false }, global: { plugins: [i18n()] } })
    const read = () => (wrapper.vm as unknown as { read: () => AdvMusicMetadata }).read()
    expect(read()).toEqual(music)
    wrapper.unmount()
    expect(musicAssetQuery(['audio/one'])).toBe('')
    expect(musicAssetQuery('audio/../other')).toBe('')
    expect(musicAssetQuery('audio/one')).toBe('audio/one')
  })
  it('uses only Core commands to insert or replace an entry cue without changing dialogue identities or ambience', () => {
    const { files } = flowFilesystem()
    const original = parseFlowDocument(files.get('adv/chapters/intro.chapter.json')!)
    expect(() => musicFlowEntryCommands(original, musicAsset())).toThrow('MUSIC_REVIEW_REQUIRED')
    const commands = musicFlowEntryCommands(original, approved())
    const result = commands.reduce((document, command) => applyFlowEdit(document, command), original)
    expect(result.nodes.slice(1)).toEqual(original.nodes)
    expect(result.custom).toEqual(original.custom)
    expect(result.startNodeId).toBe(result.nodes[0]!.id)
    expect(result.nodes[0]).toMatchObject({ type: 'audio', next: original.startNodeId, operations: [{ type: 'bgm', asset: approved().id, loop: false }] })
    const withAmbience = applyFlowEdit(result, { type: 'update-node', nodeId: result.startNodeId!, patch: { operations: [...result.nodes[0]!.operations as unknown[], { type: 'ambience', action: 'clear', slot: 'bed' }], authorNote: 'preserve' } })
    const updated = musicFlowEntryCommands(withAmbience, approved()).reduce((document, command) => applyFlowEdit(document, command), withAmbience)
    expect(updated.nodes).toHaveLength(withAmbience.nodes.length)
    expect(updated.nodes[0]).toMatchObject({ authorNote: 'preserve', operations: [{ type: 'bgm' }, { type: 'ambience', slot: 'bed' }] })
    expect(original).toEqual(parseFlowDocument(files.get('adv/chapters/intro.chapter.json')!))
  })
  it('keeps usage defaults and explicit loop choices consistent in fresh imports and native entry/picker commands', async () => {
    const wrapper = mount(AudioAssetForm, { props: { initialMusic: createMusicMetadata({ usage: 'background', source: { type: 'manual' } }), busy: false }, global: { plugins: [i18n()] } })
    const loop = wrapper.get<HTMLInputElement>('.audio-asset-form__check input')
    expect(loop.element.checked).toBe(true)
    const usage = wrapper.getComponent(AudioMusicFields).findAllComponents(SSelect)[0]!
    usage.vm.$emit('update:modelValue', 'theme')
    await wrapper.vm.$nextTick()
    expect(loop.element.checked).toBe(false)
    await loop.setValue(true)
    usage.vm.$emit('update:modelValue', 'ending')
    await wrapper.vm.$nextTick()
    expect(loop.element.checked).toBe(true)
    wrapper.unmount()
    const { files } = flowFilesystem()
    const document = parseFlowDocument(files.get('adv/chapters/intro.chapter.json')!)
    const asset = { ...approved(), loop: false }
    const cue = musicFlowEntryCommands(document, asset).find(command => command.type === 'add-node')
    expect(cue).toMatchObject({ node: { operations: [{ loop: false }] } })
    const editor = mount(FlowAudioFields, { props: { operations: [{ type: 'bgm', action: 'set' }], assets: [asset], busy: false }, global: { plugins: [i18n()] } })
    await editor.findAll('select')[2]!.setValue(asset.id)
    expect(editor.emitted('update')?.[0]?.[0]).toEqual([expect.objectContaining({ asset: asset.id, loop: false })])
    editor.unmount()
  })
  it('approves only verified native bytes and protects the actual approval CAS transaction', async () => {
    const { files, fs } = flowFilesystem()
    const asset = musicAsset()
    files.set('adv/assets.json', JSON.stringify({ schemaVersion: 2, id: 'music-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [asset] }))
    let media = bytes
    fs.readBlob = async () => new Blob([media])
    const service = createStudioAudioService(fs)
    const initial = await service.readProjectAudio()
    const reviewed = await service.reviewMusicAsset({ assetId: asset.id, expectedRevision: initial.revision, expectedSha256: sha256, status: 'approved' })
    expect(reviewed.catalog.assets[0]!.music?.review).toMatchObject({ status: 'approved', sha256 })
    await expect(service.reviewMusicAsset({ assetId: asset.id, expectedRevision: initial.revision, expectedSha256: sha256, status: 'approved' })).rejects.toThrow('CONFLICT')
    media = new Uint8Array([9, 8, 7])
    const source = files.get('adv/assets.json')
    await expect(service.reviewMusicAsset({ assetId: asset.id, expectedRevision: reviewed.revision, expectedSha256: sha256, status: 'approved' })).rejects.toThrow('CHANGED')
    expect(files.get('adv/assets.json')).toBe(source)
  })
  it('uses the existing Markdown patcher and finite CAS without rewriting prose or stable line IDs', async () => {
    const { files, fs } = flowFilesystem()
    files.set('adv.config.json', JSON.stringify({ id: 'music-md', root: 'adv', format: 'adv-md' }))
    files.delete('adv/chapters/intro.chapter.json')
    const source = '(原创旁白。) {#line_019d137e-7abc-7000-8000-00000000e002}\n'
    files.set('adv/chapters/intro.adv.md', source)
    files.set('adv/assets.json', JSON.stringify({ schemaVersion: 2, id: 'music-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [approved()] }))
    const plan = await prepareStudioMarkdownMusicBinding(fs, 'adv/chapters/intro.adv.md', approved().id)
    expect(plan.content).toContain(source)
    expect(plan.content).toContain('```advnode')
    expect(plan.content).toContain(approved().id)
    files.set('adv/chapters/intro.adv.md', `${source}\nOther author edit`)
    await expect(commitStudioMarkdownMusicBinding(fs, plan, vi.fn())).rejects.toThrow('SOURCE_CONFLICT')
    expect(files.get('adv/chapters/intro.adv.md')).toContain('Other author edit')
  })
})
