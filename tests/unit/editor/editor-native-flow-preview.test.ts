import type { FlowEditDocument } from '@advjs/core'
import type { AdvGameConfig } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive, ref, shallowRef } from 'vue'
import { useNativeFlowPreview } from '../../../editor/core/app/composables/useNativeFlowPreview'
import { compileNativeFlowPreview, nativeFlowPreviewAddress, nativeFlowPreviewSnapshot } from '../../../editor/core/app/utils/native-flow-preview'
import { compileFlowProgram } from '../../../packages/core/src/compiler/flow'
import { compileProject, serializeFlowDocument } from '../../../packages/core/src/project'
import { createAdvRuntime } from '../../../packages/core/src/runtime/headless'

const state = vi.hoisted(() => ({ project: {} as any, game: {} as any, context: {} as any }))
vi.mock('@advjs/core', async () => ({ ...await import('../../../packages/core/src/project'), ...await import('../../../packages/core/src/runtime/headless') }))
vi.mock('@advjs/client', () => ({ useAdvContext: () => ({ $adv: state.context }) }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('../../../editor/core/app/stores/useGameStore', () => ({ useGameStore: () => state.game }))

const path = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const secondLineId = 'line_019d137e-7abc-7000-8000-000000000002'
const chapter: FlowEditDocument = {
  schemaVersion: 1,
  id: 'intro',
  title: 'Preview',
  nodes: [
    { id: 'entry', type: 'start' },
    { id: 'room', type: 'background', name: 'room' },
    { id: 'greeting', type: 'dialogues', dialogues: [{ text: 'Saved first line', lineId }, { text: 'Saved second line', lineId: secondLineId }] },
    { id: 'decision', type: 'choices', choices: [{ id: 'continue', text: 'Continue', target: 'ending' }] },
    { id: 'ending', type: 'end' },
  ],
}
const wrappers: Array<{ unmount: () => void }> = []

beforeEach(async () => {
  const files = {
    'adv.config.json': JSON.stringify({ id: 'preview', root: 'adv', format: 'flow' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Preview', variables: { draft: true }, chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }] }),
    'adv/scenes/room.md': '---\nid: room\nname: Room\nsrc: /img/room.svg\n---\n',
    'public/img/room.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    [path]: serializeFlowDocument(chapter),
  }
  state.project = reactive({
    project: { files, compilation: await compileProject({ files }) },
    workspace: {
      kind: 'browser',
      readDocuments: vi.fn(async () => ({ files: { ...state.project.project.files } })),
      assetUrl: vi.fn(async () => 'blob:preview-room'),
      writeFiles: vi.fn(),
      snapshot: vi.fn(),
    },
    writeProjectFiles: vi.fn(),
  })
  state.context = { store: {} }
  state.game = reactive({
    curAdapter: 'default',
    loadGameFromConfig: vi.fn(async (config: AdvGameConfig, options: { isCurrent: () => boolean, start: boolean }) => {
      const result = await compileFlowProgram({ id: 'actual-client-program', chapters: config.chapters })
      if (!options.isCurrent())
        return false
      if (!result.program)
        throw new Error(JSON.stringify(result.diagnostics))
      state.context.store.program = result.program
      state.context.runtime = createAdvRuntime({ program: result.program })
      return true
    }),
  })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  delete (window as any).advDesktop
  vi.restoreAllMocks()
})

function preview() {
  const options = { path: ref(path), document: shallowRef<FlowEditDocument | undefined>(structuredClone(chapter)), selectedNodeId: ref('greeting'), selectedLineId: ref<string>() }
  let api!: ReturnType<typeof useNativeFlowPreview>
  const wrapper = mount(defineComponent({ setup() {
    api = useNativeFlowPreview(options)
    return () => null
  } }))
  wrappers.push(wrapper)
  return { api, options, wrapper }
}

describe('native Flow selected draft preview', () => {
  it('follows explicit silent-node routes across chapters without previewing unrelated array neighbors', async () => {
    const routed = { ...chapter, nodes: [{ id: 'entry', type: 'start', next: 'later' }, { id: 'wrong', type: 'narration', text: 'Wrong array neighbor' }, { id: 'later', type: 'narration', text: 'Correct route' }] } as FlowEditDocument
    const result = await compileFlowProgram({ id: 'routes', chapters: [routed as any, { id: 'other', title: 'Other', nodes: [{ id: 'target', type: 'narration', text: 'Other chapter' }] }] })
    const program = result.program!
    const origin = createAdvRuntime({ program }).snapshot()
    const selection = { document: routed, nodeId: 'entry' }
    expect(nativeFlowPreviewSnapshot(program, origin, selection).snapshot.state.cursor).toEqual({ chapterId: 'intro', nodeId: 'later' })
    program.chapters.intro!.nodes.entry!.next = { chapterId: 'other', nodeId: 'target' }
    expect(nativeFlowPreviewSnapshot(program, origin, selection).snapshot.state.cursor).toEqual({ chapterId: 'other', nodeId: 'target' })
  })

  it('respects a disconnected selected effect and rejects silent route cycles', async () => {
    const routed = { ...chapter, nodes: [{ id: 'room', type: 'background', name: 'room', next: null }, { id: 'wrong', type: 'narration', text: 'Must not play' }] } as FlowEditDocument
    const result = await compileFlowProgram({ id: 'routes', chapters: [routed as any] })
    const program = result.program!
    const origin = createAdvRuntime({ program }).snapshot()
    const selection = { document: routed, nodeId: 'room' }
    const snapshot = nativeFlowPreviewSnapshot(program, origin, selection).snapshot
    expect(snapshot.state.cursor).toEqual({ chapterId: 'intro', nodeId: 'room' })
    expect(snapshot.state.stage.background).toBe('room')
    expect(snapshot.state.status).toBe('ended')
    program.chapters.intro!.nodes.room!.next = { chapterId: 'intro', nodeId: 'room' }
    expect(() => nativeFlowPreviewSnapshot(program, origin, selection)).toThrow('ADV_FLOW_PREVIEW_SILENT_LOOP')
  })

  it('loads the unsaved draft into the actual runtime with its stable line and derived stage, without writing or activating source', async () => {
    const { api, options } = preview()
    const files = { ...state.project.project.files }
    const model = state.project.project
    const draft = structuredClone(chapter)
    ;(draft.nodes[2]!.dialogues as Array<{ text: string }>)[0]!.text = 'Unsaved proposed first line'
    options.document.value = draft
    expect(await api.preview()).toBe(true)
    expect(state.context.runtime.current).toMatchObject({ id: 'greeting', data: { text: 'Unsaved proposed first line', lineId } })
    expect(state.context.runtime.state.stage.background).toBe('room')
    expect(state.context.runtime.state.variables).toEqual({ draft: true })
    expect(state.context.runtime.snapshot().checkpoints).toEqual([])
    expect(state.game.loadGameFromConfig.mock.calls[0][0].scenes[0].src).toBe('blob:preview-room')
    expect(state.game.loadGameFromConfig.mock.calls[0][1].start).toBe(false)
    expect(state.game.loadGameFromConfig.mock.calls[0][1].persistence).toBe(false)
    expect(api.selected.value).toEqual({ chapterId: 'intro', nodeId: 'greeting' })
    expect(state.project.project).toBe(model)
    expect(state.project.project.files).toEqual(files)
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
    expect(state.project.workspace.snapshot).not.toHaveBeenCalled()
    expect(state.project.writeProjectFiles).not.toHaveBeenCalled()
    expect(options.document.value).toBe(draft)
    await state.context.runtime.next()
    expect(state.context.runtime.current.data.lineId).toBe(secondLineId)
    await state.context.runtime.next()
    expect(state.context.runtime.state.status).toBe('waiting-choice')
    await state.context.runtime.choose('continue')
    expect(state.context.runtime.state.status).toBe('ended')
  })

  it('resolves a selected dialogue by line identity after insertion instead of guessing compiler suffixes', async () => {
    const { api, options } = preview()
    const draft = structuredClone(chapter)
    ;(draft.nodes[2]!.dialogues as unknown[]).unshift({ text: 'Inserted line', lineId: 'line_019d137e-7abc-7000-8000-000000000003' })
    options.document.value = draft
    options.selectedLineId.value = secondLineId
    expect(await api.preview()).toBe(true)
    expect(state.context.runtime.current).toMatchObject({ id: 'greeting.dialog-3', data: { lineId: secondLineId, text: 'Saved second line' } })
    expect(() => nativeFlowPreviewAddress(state.context.store.program, { document: draft, nodeId: 'decision', lineId: secondLineId })).toThrow('ADV_FLOW_PREVIEW_LINE_MISSING')
  })

  it('previews an unsaved new chapter without saving its explicit source declaration', async () => {
    const files = { ...state.project.project.files }
    const result = await compileNativeFlowPreview({ files, path: 'adv/chapters/new.chapter.json', document: { ...chapter, id: 'new', nodes: [{ id: 'new-line', type: 'narration', text: 'New unsaved chapter' }] }, nodeId: 'new-line' })
    expect(result.valid).toBe(true)
    expect(result.config?.chapters.map(chapter => chapter.id)).toEqual(['intro', 'new'])
    expect(files).not.toHaveProperty('adv/chapters/new.chapter.json')
    expect(JSON.parse(files['adv/settings/game.json']).chapters).toHaveLength(1)
    expect(result.files).toHaveProperty('adv/chapters/new.chapter.json')
  })

  it('blocks invalid drafts and stale selected IDs before changing the loaded player', async () => {
    const { api, options } = preview()
    options.document.value = { ...chapter, nodes: [{ id: 'bad', type: 'narration', text: 'Broken', next: 'missing' }] }
    options.selectedNodeId.value = 'bad'
    expect(await api.preview()).toBe(false)
    expect(api.diagnostics.value.some(issue => issue.severity === 'error')).toBe(true)
    expect(state.game.loadGameFromConfig).not.toHaveBeenCalled()
    options.document.value = structuredClone(chapter)
    options.selectedNodeId.value = 'deleted'
    expect(await api.preview()).toBe(false)
    expect(api.error.value).toContain('ADV_FLOW_PREVIEW_NODE_MISSING')
    expect(state.game.loadGameFromConfig).not.toHaveBeenCalled()
    options.document.value = { ...chapter, nodes: [{ id: 'loop', type: 'start', next: 'loop' }] }
    options.selectedNodeId.value = 'loop'
    expect(await api.preview()).toBe(false)
    expect(state.game.loadGameFromConfig).not.toHaveBeenCalled()
  })

  it('does not let an older asynchronous read replace a newer draft preview', async () => {
    const { api, options } = preview()
    let resolveRead!: (value: any) => void
    state.project.workspace.readDocuments.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRead = resolve
    }))
    const old = api.preview()
    options.selectedNodeId.value = 'decision'
    expect(await api.preview()).toBe(true)
    resolveRead({ files: { ...state.project.project.files } })
    expect(await old).toBe(false)
    expect(state.game.loadGameFromConfig).toHaveBeenCalledOnce()
    expect(state.context.runtime.current.id).toBe('decision')
    expect(api.selected.value?.nodeId).toBe('decision')
    expect(api.pending.value).toBe(false)
  })

  it('cancels a pending media resolution when the project changes', async () => {
    const { api } = preview()
    let resolveAsset!: (value: string) => void
    state.project.workspace.assetUrl.mockImplementationOnce(() => new Promise((resolve) => {
      resolveAsset = resolve
    }))
    const old = api.preview()
    await vi.waitFor(() => expect(resolveAsset).toBeTypeOf('function'))
    state.project.project = { ...state.project.project, files: { ...state.project.project.files } }
    resolveAsset('blob:old-preview')
    expect(await old).toBe(false)
    expect(state.game.loadGameFromConfig).not.toHaveBeenCalled()
    expect(api.error.value).toBe('')
    expect(api.pending.value).toBe(false)
  })

  it('rejects privileged desktop playback but supports a browser-hosted local bridge and cancels on unmount', async () => {
    const { api } = preview()
    ;(window as any).advDesktop = {}
    expect(await api.preview()).toBe(false)
    expect(api.unavailableReason.value).toContain('先保存')
    expect(state.game.loadGameFromConfig).not.toHaveBeenCalled()
    delete (window as any).advDesktop
    const local = preview()
    state.project.workspace = { ...state.project.workspace, kind: 'local' }
    await flushPromises()
    expect(await local.api.preview()).toBe(true)
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
    state.game.loadGameFromConfig.mockClear()
    let resolveRead!: (value: any) => void
    state.project.workspace.readDocuments.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRead = resolve
    }))
    const pending = local.api.preview()
    local.wrapper.unmount()
    resolveRead({ files: state.project.project.files })
    expect(await pending).toBe(false)
    expect(state.game.loadGameFromConfig).not.toHaveBeenCalled()
  })
})
