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

  it('cancels reload without changing draft or history and only discards after confirmation', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    api.edit({ type: 'update-node', nodeId: 'hello', patch: { text: 'Keep me' } })
    const history = api.current.value?.history
    await api.requestReload()
    expect(api.pendingReload.value?.path).toBe(path)
    api.cancelReload()
    expect(api.current.value?.history).toBe(history)
    expect(api.dirty.value).toBe(true)
    await api.requestReload()
    await api.confirmReload()
    expect(api.document.value?.nodes[0]?.text).toBe('Hello')
    expect(api.dirty.value).toBe(false)
    expect(api.current.value?.history.past).toEqual([])
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
  })

  it('discards an unsaved chapter without creating files and ignores stale confirmation', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await api.createChapter('mistake', 'Wrong chapter')
    await api.requestReload()
    api.cancelReload()
    expect(api.document.value?.id).toBe('mistake')
    await api.requestReload()
    await api.confirmReload()
    expect(api.document.value?.id).toBe('intro')
    expect(api.chapterPaths.value).toEqual([path])
    expect(api.dirty.value).toBe(false)
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
    api.edit({ type: 'set-title', title: 'Draft' })
    await api.requestReload()
    api.edit({ type: 'set-title', title: 'Newer draft' })
    await api.confirmReload()
    expect(api.document.value?.title).toBe('Newer draft')
  })

  it('clears loading when returning to a cached draft and ignores the old read', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await flushPromises()
    api.edit({ type: 'set-title', title: 'Cached draft' })
    await flushPromises()
    let resolveRead!: (value: any) => void
    const originalRead = state.project.workspace.readDocuments
    state.project.workspace.readDocuments = vi.fn().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRead = resolve
    })).mockImplementation(originalRead)
    const opening = api.open('adv/chapters/other.chapter.json')
    expect(api.loading.value).toBe(true)
    await api.open(path)
    expect(api.loading.value).toBe(false)
    resolveRead({ files: { ...state.project.project.files, 'adv/chapters/other.chapter.json': serializeFlowDocument({ ...chapter, id: 'other' }) } })
    await opening
    expect(api.path.value).toBe(path)
    expect(api.document.value?.title).toBe('Cached draft')
    expect(api.canSave.value).toBe(true)
  })

  it('refreshes a clean cached chapter changed while away without replacing dirty chapters', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await api.createChapter('ending', 'Ending')
    state.project.project.files[path] = serializeFlowDocument({ ...chapter, title: 'External update' })
    await api.open(path)
    expect(api.document.value?.title).toBe('External update')
    expect(api.conflict.value).toBe(false)
    api.edit({ type: 'set-title', title: 'My draft' })
    await api.open('adv/chapters/ending.chapter.json')
    state.project.project.files[path] = serializeFlowDocument({ ...chapter, title: 'Another update' })
    await api.open(path)
    expect(api.document.value?.title).toBe('My draft')
    expect(api.conflict.value).toBe(true)
  })

  it('ignores rejected reads after switching back to a cached chapter', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await flushPromises()
    let rejectRead!: (error: Error) => void
    const originalRead = state.project.workspace.readDocuments
    state.project.workspace.readDocuments = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectRead = reject
    })).mockImplementation(originalRead)
    const opening = api.open('adv/chapters/missing.chapter.json')
    await api.open(path)
    api.selectedNodeId.value = 'end'
    rejectRead(new Error('Old read failed'))
    await opening
    expect(api.selectedNodeId.value).toBe('end')
    expect(api.error.value).toBe('')
    expect(api.loading.value).toBe(false)
  })

  it('does not let delayed chapter creation overwrite a draft or interrupt newer navigation', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await flushPromises()
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    let resolveDigest!: (value: ArrayBuffer) => void
    const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => new Promise((resolve) => {
      resolveDigest = resolve
    }))
    const late = api.createChapter('ending', 'Late title')
    await api.createChapter('ending', 'First completed')
    api.edit({ type: 'set-title', title: 'Keep newer draft' })
    resolveDigest(await digest('SHA-256', new TextEncoder().encode('absent:')))
    await late
    expect(api.document.value?.title).toBe('Keep newer draft')
    expect(api.current.value?.history.past).toHaveLength(1)
    spy.mockImplementationOnce(() => new Promise((resolve) => {
      resolveDigest = resolve
    }))
    const abandoned = api.createChapter('abandoned', 'Abandoned')
    await api.open(path)
    resolveDigest(await digest('SHA-256', new TextEncoder().encode('absent:')))
    await abandoned
    expect(api.path.value).toBe(path)
    expect(api.chapterPaths.value).not.toContain('adv/chapters/abandoned.chapter.json')
    spy.mockRestore()
  })

  it('saves a new chapter repeatedly without duplicate source declarations', async () => {
    state.project.project.files['adv/settings/game.json'] = JSON.stringify({ title: 'Native', entryChapterId: 'intro', chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }] })
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await api.createChapter('ending', 'Ending')
    expect(await api.save()).toBe(true)
    api.edit({ type: 'set-title', title: 'Revised ending' })
    expect(await api.save()).toBe(true)
    await api.open(api.path.value, true)
    expect(api.document.value?.title).toBe('Revised ending')
    const game = JSON.parse(state.project.project.files['adv/settings/game.json'])
    expect(game.chapters.filter((entry: { id: string }) => entry.id === 'ending')).toHaveLength(1)
    expect(api.dirty.value).toBe(false)
  })

  it('locks mutation and duplicate saves while loading or saving', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await flushPromises()
    let resolveRead!: (value: any) => void
    const originalRead = state.project.workspace.readDocuments
    state.project.workspace.readDocuments = vi.fn().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRead = resolve
    })).mockImplementation(originalRead)
    const opening = api.open(path, true)
    api.edit({ type: 'set-title', title: 'Cannot edit hidden source' })
    expect(api.document.value?.title).toBe('Original')
    expect(await api.save()).toBe(false)
    resolveRead(await originalRead())
    await opening
    api.edit({ type: 'set-title', title: 'Saved once' })
    const saving = api.save()
    expect(await api.save()).toBe(false)
    api.history('undo')
    expect(api.document.value?.title).toBe('Saved once')
    expect(await saving).toBe(true)
    await api.open(path, true)
    expect(api.document.value?.title).toBe('Saved once')
    expect(state.project.writeProjectFiles).toHaveBeenCalledOnce()
  })

  it('allows repairing a valid chapter when a different chapter is malformed', async () => {
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    state.project.project.files['adv/chapters/broken.chapter.json'] = '{'
    api.edit({ type: 'set-title', title: 'Repaired title' })
    expect(api.document.value?.title).toBe('Repaired title')
    await vi.waitFor(() => expect(api.diagnostics.value.some(issue => issue.severity === 'error')).toBe(true))
    expect(api.canSave.value).toBe(false)
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

describe('native Flow AI proposal review and draft adoption', () => {
  async function ready() {
    // A reachable ending keeps strict Flow static validation meaningful.
    const document = { ...chapter, nodes: chapter.nodes.map(node => node.id === 'hello' ? { ...node, next: 'end' } : node) }
    state.project.project.files[path] = serializeFlowDocument(document)
    const { api } = authoring()
    await vi.waitFor(() => expect(api.document.value?.id).toBe('intro'))
    await flushPromises()
    const request = JSON.parse(await api.proposalTemplate())
    request.commands = [{ type: 'update-node', nodeId: 'hello', patch: { text: 'AI proposed dialogue' } }]
    return { api, request }
  }

  it('reviews without writes, adopts once with original CAS and permits human tweaks, undo and save', async () => {
    const { api, request } = await ready()
    const before = JSON.stringify(state.project.project.files)
    await api.reviewProposal(request)
    expect(api.proposal.value?.plan.valid).toBe(true)
    expect(api.document.value?.nodes[0]?.text).toBe('Hello')
    expect(JSON.stringify(state.project.project.files)).toBe(before)
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
    const revision = api.current.value!.snapshot.revision
    await api.loadProposal()
    expect(api.document.value?.nodes[0]?.text).toBe('AI proposed dialogue')
    expect(api.selectedLineId.value).toBe(lineId)
    expect(api.current.value?.snapshot.revision).toBe(revision)
    expect(api.dirty.value).toBe(true)
    api.history('undo')
    expect(api.document.value?.nodes[0]?.text).toBe('Hello')
    api.history('redo')
    api.edit({ type: 'update-node', nodeId: 'hello', patch: { text: 'Human final dialogue' } })
    expect(await api.save()).toBe(true)
    await api.open(path, true)
    expect(api.document.value?.nodes[0]?.text).toBe('Human final dialogue')
    expect(api.document.value?.nodes[0]?.lineId).toBe(lineId)
    expect(api.document.value?.nodes[0]?.metadata).toEqual({ retain: true })
  })

  it('retains human drafts and rejects malformed or invalid proposals without writes', async () => {
    const { api, request } = await ready()
    api.edit({ type: 'set-title', title: 'Human draft' })
    await api.reviewProposal(request)
    expect(api.error.value).toContain('先保存或放弃')
    expect(api.document.value?.title).toBe('Human draft')
    api.history('undo')
    await api.reviewProposal({ ...request, commands: [{ type: 'connect', nodeId: 'hello', target: 'missing' }] })
    expect(api.proposal.value?.plan.valid).toBe(false)
    await api.loadProposal()
    expect(api.dirty.value).toBe(false)
    api.dismissProposal()
    expect(api.proposal.value).toBeUndefined()
    await api.reviewProposal({ ...request, commands: [{ type: 'unknown' }] })
    expect(api.error.value).toBeTruthy()
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
  })

  it('checks whole-project changes both after review and after adoption, preserving draft', async () => {
    const { api, request } = await ready()
    await api.reviewProposal(request)
    const gamePath = 'adv/settings/game.json'
    const original = state.project.project.files[gamePath]
    state.project.project.files[gamePath] = JSON.stringify({ title: 'External author' })
    await api.loadProposal()
    expect(api.error.value).toContain('SOURCE_CONFLICT')
    expect(api.dirty.value).toBe(false)
    state.project.project.files[gamePath] = original
    await api.reviewProposal(request)
    await api.loadProposal()
    state.project.project.files[gamePath] = JSON.stringify({ title: 'Second external edit' })
    expect(await api.save()).toBe(false)
    expect(api.error.value).toContain('SOURCE_CONFLICT')
    expect(api.document.value?.nodes[0]?.text).toBe('AI proposed dialogue')
    expect(api.dirty.value).toBe(true)
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
  })

  it('cancels an in-flight review when proposal input is dismissed or replaced', async () => {
    const { api, request } = await ready()
    const files = { ...state.project.project.files }
    let release!: (value: { files: typeof files }) => void
    state.project.workspace.readDocuments = () => new Promise((resolve) => {
      release = resolve
    })
    const pending = api.reviewProposal(request)
    await flushPromises()
    api.dismissProposal()
    release({ files })
    await pending
    expect(api.proposal.value).toBeUndefined()
    expect(api.loading.value).toBe(false)
    expect(api.dirty.value).toBe(false)
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
  })

  it('ignores a review read completed after workspace replacement', async () => {
    const { api, request } = await ready()
    const files = { ...state.project.project.files }
    let release!: (value: { files: typeof files }) => void
    state.project.workspace.readDocuments = () => new Promise((resolve) => {
      release = resolve
    })
    const pending = api.reviewProposal(request)
    await flushPromises()
    state.project.workspace = { writeFiles: vi.fn(), readDocuments: async () => ({ files }) }
    await flushPromises()
    release({ files })
    await pending
    expect(api.proposal.value).toBeUndefined()
    expect(api.dirty.value).toBe(false)
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
  })
})
