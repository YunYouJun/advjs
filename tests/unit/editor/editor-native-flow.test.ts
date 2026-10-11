import type { FlowEditDocument } from '@advjs/core'
import { compileProject, parseFlowDocument, serializeFlowDocument } from '@advjs/core'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive } from 'vue'
import NativeFlowInspector from '../../../editor/core/app/components/system/flow/NativeFlowInspector.vue'
import { useNativeFlowAuthoring } from '../../../editor/core/app/composables/useNativeFlowAuthoring'

const state = vi.hoisted(() => ({ project: {} as any, register: vi.fn(), remove: vi.fn() }))
vi.mock('@advjs/core', () => import('../../../packages/core/src/project'))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('../../../editor/core/app/stores/useProjectDrafts', () => ({ useProjectDrafts: () => ({ register: state.register, remove: state.remove }) }))
const path = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const chapter: FlowEditDocument = { schemaVersion: 1, id: 'intro', title: 'Original', nodes: [{ id: 'hello', type: 'narration', text: 'Hello', lineId, next: null, metadata: { retain: true } }, { id: 'end', type: 'end' }] }
const wrappers: Array<{ unmount: () => void }> = []
beforeEach(async () => {
  const files = { 'adv.config.json': JSON.stringify({ id: 'native', format: 'flow', root: 'adv' }), 'adv/settings/game.json': JSON.stringify({ title: 'Native' }), [path]: serializeFlowDocument(chapter) }
  state.project = reactive({ project: { files, compilation: await compileProject({ files }) }, workspace: { writeFiles: vi.fn(), readDocuments: async () => ({ files: { ...state.project.project.files } }) }, writeProjectFiles: vi.fn(async (changes) => {
    changes.forEach((change: { path: string, expected: string | null, content: string }) => {
      if ((state.project.project.files[change.path] ?? null) !== change.expected)
        throw new Error('ADV_FLOW_SOURCE_CONFLICT')
    })
    state.project.project.files = { ...state.project.project.files, ...Object.fromEntries(changes.map((change: { path: string, content: string }) => [change.path, change.content])) }
  }) })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function authoring() {
  let api!: ReturnType<typeof useNativeFlowAuthoring>
  const wrapper = mount(defineComponent({ setup() {
    api = useNativeFlowAuthoring()
    return () => null
  } }))
  wrappers.push(wrapper)
  return { wrapper, get api() {
    return api
  } }
}

describe('editor native JSON Flow authoring', () => {
  it('starts clean, retains immutable line metadata across undo/redo, and saves through native file CAS', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    expect(api.dirty.value).toBe(false)
    api.edit({ type: 'update-node', nodeId: 'hello', patch: { text: 'Author draft' } })
    await flushPromises()
    expect(api.dirty.value).toBe(true)
    api.history('undo')
    expect(api.document.value?.nodes[0]?.text).toBe('Hello')
    api.history('redo')
    expect(api.document.value?.nodes[0]).toMatchObject({ text: 'Author draft', lineId, metadata: { retain: true } })
    expect(await api.save()).toBe(true)
    expect(api.dirty.value).toBe(false)
    expect(parseFlowDocument(state.project.project.files[path]).nodes[0]?.text).toBe('Author draft')
    expect(state.project.writeProjectFiles).toHaveBeenCalledOnce()
  })

  it('keeps a dirty draft after external edits or host rejection and remembers drafts while switching chapters', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    api.edit({ type: 'update-node', nodeId: 'hello', patch: { text: 'Keep this draft' } })
    state.project.project.files[path] += ' '
    await flushPromises()
    expect(api.conflict.value).toBe(true)
    expect(await api.save()).toBe(false)
    expect(api.document.value?.nodes[0]?.text).toBe('Keep this draft')
    await api.createChapter('ending', 'Ending')
    expect(api.path.value).toBe('adv/chapters/ending.chapter.json')
    await api.open(path)
    expect(api.document.value?.nodes[0]?.text).toBe('Keep this draft')
    expect(api.conflict.value).toBe(true)
  })

  it('renders real AGUI / Reka selectors, edits conditions and disconnects without dropping choice metadata', async () => {
    const document = parseFlowDocument(JSON.stringify({ ...chapter, nodes: [{ id: 'branch', type: 'choices', next: null, choices: [{ id: 'yes', text: 'Continue', target: 'end', when: 'ready == true', authorData: { keep: true } }] }, ...chapter.nodes] }))
    const edit = vi.fn()
    const wrapper = mount(NativeFlowInspector, { attachTo: window.document.body, props: { document, node: document.nodes[0]!, onEdit: edit } })
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.get('[role="combobox"][aria-label="后继模式"]').text()).toBe('停止后继')
    await wrapper.get('[aria-label="选项 yes 条件"]').setValue('ready == false')
    expect(edit).toHaveBeenLastCalledWith({ type: 'update-choice', nodeId: 'branch', choiceId: 'yes', patch: { when: 'ready == false' }, remove: [] })
    const disconnect = wrapper.findAll('button').find(button => button.text() === '断开选项')!
    await disconnect.trigger('click')
    expect(edit).toHaveBeenLastCalledWith({ type: 'disconnect', nodeId: 'branch', choiceId: 'yes' })
    expect(document.nodes[0]?.choices).toEqual([{ id: 'yes', text: 'Continue', target: 'end', when: 'ready == true', authorData: { keep: true } }])
  })
})
