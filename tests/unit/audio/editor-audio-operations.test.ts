import type { AdvAssetManifest } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import AEInlineAudioEditor from '../../../editor/core/app/components/panel/audio/AEInlineAudioEditor.vue'
import ProjectFlowAudioInspector from '../../../editor/core/app/components/system/flow/ProjectFlowAudioInspector.vue'
import { parseAst } from '../../../packages/parser/src'

vi.mock('@advjs/core', () => import('../../../packages/core/src/project'))
const path = 'adv/chapters/intro.adv.md'
const original = '# Story\n\n故事继续。\n'
const catalog: AdvAssetManifest = { schemaVersion: 2, id: 'fixture', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: ['bgm', 'ambience', 'sfx', 'reference'].map(kind => ({ id: `audio-${kind}`, type: 'audio', kind: kind as 'bgm', path: `${kind}.wav`, title: kind })) }
const field = { props: ['modelValue', 'options', 'disabled', 'id'], emits: ['update:modelValue'], template: '<select :id="id" :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :value="option.value">{{ option.label }}</option></select>' }
const global = { stubs: { AGUISelect: field } }
let project: { workspace: object, project: { files: Record<string, string>, compilation: { project: { assets: AdvAssetManifest } } }, writeProjectFiles: ReturnType<typeof vi.fn> }
let file: { openedFilePath: string, isDirty: boolean }
const mounted: Array<{ unmount: () => void }> = []

beforeEach(() => {
  project = reactive({ workspace: { writeFiles: true }, project: { files: { [path]: original }, compilation: { project: { assets: catalog } } }, writeProjectFiles: vi.fn(async (changes: Array<{ path: string, expected: string, content: string }>) => {
    for (const change of changes) {
      if (project.project.files[change.path] !== change.expected)
        throw new Error('AUDIO_CONFLICT')
      project.project.files[change.path] = change.content
    }
  }) })
  file = reactive({ openedFilePath: '', isDirty: false })
  vi.stubGlobal('useProjectStore', () => project)
  vi.stubGlobal('useFileStore', () => file)
})
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
})

async function chooseMusic(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-testid="audio-operation-add"]').trigger('click')
  const selects = wrapper.findAll('select')
  await selects[2]!.setValue('audio-bgm')
}

describe('editor scene audio workflow', () => {
  it('writes the selected graph source with exact CAS and a canonical native operation', async () => {
    const wrapper = mount(ProjectFlowAudioInspector, { props: { source: { path, line: 3, column: 1 }, zh: true, busy: false }, global })
    mounted.push(wrapper)
    await flushPromises()
    await chooseMusic(wrapper)
    await wrapper.get('[data-testid="flow-audio-save"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('场景音频已保存。'))
    expect(project.writeProjectFiles).toHaveBeenCalledWith([{ path, expected: original, content: expect.any(String) }])
    const ast = await parseAst(project.project.files[path]!)
    expect(ast.children[1]).toMatchObject({ type: 'code', value: [{ type: 'bgm', action: 'set', asset: 'audio-bgm', gain: 1 }] })
    expect(project.project.files[path]).toContain('故事继续。')
  })

  it('keeps graph drafts when the source changes and refuses to overwrite an unsaved source editor', async () => {
    const wrapper = mount(ProjectFlowAudioInspector, { props: { source: { path, line: 3, column: 1 }, zh: true, busy: false }, global })
    mounted.push(wrapper)
    await flushPromises()
    await chooseMusic(wrapper)
    file.openedFilePath = path
    file.isDirty = true
    await flushPromises()
    expect(wrapper.get('[data-testid="flow-audio-save"]').attributes('disabled')).toBeDefined()
    file.isDirty = false
    project.project.files[path] = '# Story\n\n故事改变。\n'
    await flushPromises()
    expect(wrapper.text()).toContain('草稿已保留')
    expect(wrapper.get('[data-testid="flow-audio-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('select')[2]!.element).toHaveProperty('value', 'audio-bgm')
    expect(project.writeProjectFiles).not.toHaveBeenCalled()
  })

  it('applies to a source draft only, excludes reference assets and rejects changed drafts', async () => {
    const wrapper = mount(AEInlineAudioEditor, { props: { content: original, currentContent: original, line: 3, catalog, zh: true }, global })
    mounted.push(wrapper)
    await flushPromises()
    await chooseMusic(wrapper)
    expect(wrapper.findAll('option').map(option => option.attributes('value'))).not.toContain('audio-reference')
    await wrapper.get('[data-testid="inline-audio-apply"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('apply')).toHaveLength(1))
    expect(wrapper.emitted('apply')![0]![0]).toEqual({ expected: original, content: expect.stringContaining('"asset": "audio-bgm"') })
    expect(project.writeProjectFiles).not.toHaveBeenCalled()
    await wrapper.setProps({ currentContent: '故事改变。' })
    expect(wrapper.get('[data-testid="inline-audio-apply"]').attributes('disabled')).toBeDefined()
  })
})
