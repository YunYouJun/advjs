import type { FlowAuthoringSnapshot, FlowEditCommand, FlowEditDocument, FlowEditHistory, FlowEditValidation, FlowNodeKind } from '@advjs/core'
import type { Ref } from 'vue'
import type { IFileSystem } from '../utils/fs'
import { createFlowEditHistory, createFlowNode, flowDocumentRevision, flowEditGraph, parseFlowDocument, reduceFlowEditHistory } from '@advjs/core'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { createStudioFlowAuthoringService } from '../utils/flowAuthoring'
import { useProjectContent } from './useProjectContent'

/** A shallow immutable draft uses the exact same command/history protocol as Editor. */
export function useFlowAuthoring(active: Ref<boolean>, file: Ref<string>) {
  const project = useProjectContent()
  const studio = useStudioStore()
  const auth = useAuthStore()
  const snapshot = shallowRef<FlowAuthoringSnapshot>()
  const history = shallowRef<FlowEditHistory>()
  const validation = shallowRef<FlowEditValidation>()
  const otherChapters = shallowRef<FlowEditDocument[]>([])
  const selectedId = shallowRef('')
  const busy = shallowRef(false)
  const error = shallowRef('')
  let epoch = 0
  let scopeFs: IFileSystem | null = null
  const document = computed(() => history.value?.present)
  const dirty = computed(() => Boolean(document.value && snapshot.value && (snapshot.value.content === null || JSON.stringify(document.value) !== JSON.stringify(snapshot.value.document))))
  const selected = computed(() => document.value?.nodes.find(node => node.id === selectedId.value))
  const graph = computed(() => document.value ? flowEditGraph(document.value) : { nodes: [], edges: [] })
  const canUndo = computed(() => Boolean(history.value?.past.length))
  const canRedo = computed(() => Boolean(history.value?.future.length))
  function cancelPending() {
    epoch++
    busy.value = false
  }
  function invalidate() {
    cancelPending()
    scopeFs = null
    snapshot.value = undefined
    history.value = undefined
    validation.value = undefined
    selectedId.value = ''
    error.value = ''
  }
  async function run(operation: 'read' | 'validate' | 'save' | 'create', newChapter?: { id: string, title: string }) {
    if (!active.value || busy.value || !file.value)
      return
    const capturedEpoch = ++epoch
    const projectId = studio.currentProjectId
    const actorId = auth.userId
    const path = file.value
    let fs: IFileSystem | null = null
    const assertCurrent = () => {
      if (capturedEpoch !== epoch || projectId !== studio.currentProjectId || actorId !== auth.userId || !active.value || path !== file.value || (fs && fs !== project.getFs()))
        throw new Error('ADV_FLOW_SCOPE_CHANGED')
    }
    busy.value = true
    error.value = ''
    try {
      await project.whenReady()
      assertCurrent()
      fs = project.getFs()
      if (!fs)
        throw new Error('ADV_FLOW_PROJECT_REQUIRED')
      if (scopeFs && scopeFs !== fs)
        throw new Error('ADV_FLOW_SCOPE_CHANGED')
      scopeFs = fs
      const service = createStudioFlowAuthoringService(fs, assertCurrent)
      if (operation === 'read' || operation === 'create') {
        let result: FlowAuthoringSnapshot
        if (operation === 'create') {
          if (await fs.exists(path))
            throw new Error('ADV_FLOW_SOURCE_CONFLICT')
          const start = createFlowNode('start')
          const end = createFlowNode('end')
          start.next = end.id
          result = { path, content: null, revision: await flowDocumentRevision(null), document: { schemaVersion: 1, id: newChapter!.id, title: newChapter!.title, startNodeId: start.id, nodes: [start, end] } }
        }
        else { result = await service.read(path) }
        const others = (await fs.collectAllFiles('adv/chapters')).filter(source => source.path !== path && source.path.endsWith('.chapter.json')).map(source => parseFlowDocument(source.content))
        assertCurrent()
        snapshot.value = result
        history.value = createFlowEditHistory(result.document)
        otherChapters.value = others
        selectedId.value = result.document.startNodeId ?? result.document.nodes[0]?.id ?? ''
        const checked = await (result.content === null ? service.validateCreate({ path, document: result.document }) : service.validate({ path, document: result.document }))
        assertCurrent()
        validation.value = checked
      }
      else if (document.value && snapshot.value) {
        const result = await (snapshot.value.content === null ? service.validateCreate({ path, document: document.value }) : service.validate({ path, document: document.value }))
        assertCurrent()
        validation.value = result
        if (operation === 'save' && result.valid) {
          const saved = await (snapshot.value.content === null ? service.create({ path, document: document.value, expectedRevision: snapshot.value.revision }) : service.save({ path, document: document.value, expectedRevision: snapshot.value.revision }))
          assertCurrent()
          snapshot.value = saved
          await project.reload()
        }
      }
    }
    catch (cause) {
      if (capturedEpoch === epoch)
        error.value = cause instanceof Error ? cause.message : 'ADV_FLOW_REQUEST_FAILED'
    }
    finally {
      if (capturedEpoch === epoch)
        busy.value = false
    }
  }
  function dispatch(command: FlowEditCommand) {
    if (!history.value || busy.value)
      return
    try {
      history.value = reduceFlowEditHistory(history.value, { type: 'edit', command, context: { otherChapters: otherChapters.value } })
      validation.value = undefined
      error.value = ''
      if (command.type === 'add-node')
        selectedId.value = command.node.id
      if (!document.value?.nodes.some(node => node.id === selectedId.value))
        selectedId.value = document.value?.nodes[0]?.id ?? ''
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : 'ADV_FLOW_EDIT_FAILED' }
  }
  function travel(type: 'undo' | 'redo') {
    if (history.value && !busy.value) {
      history.value = reduceFlowEditHistory(history.value, { type })
      validation.value = undefined
      error.value = ''
      if (!document.value?.nodes.some(node => node.id === selectedId.value))
        selectedId.value = document.value?.nodes[0]?.id ?? ''
    }
  }
  watch([() => studio.currentProjectId, () => auth.userId], () => {
    invalidate()
    if (active.value && file.value)
      void run('read')
  }, { flush: 'sync' })
  watch([() => project.getFs(), () => project.isLoading.value], () => {
    if (scopeFs && scopeFs !== project.getFs()) {
      invalidate()
      if (active.value && file.value)
        void run('read')
    }
  }, { flush: 'sync' })
  watch([active, file], ([isActive, path], previous) => {
    cancelPending()
    if (previous && path !== previous[1])
      invalidate()
    if (!isActive || !path)
      return
    if (scopeFs && scopeFs !== project.getFs())
      invalidate()
    if (!snapshot.value || snapshot.value.path !== path)
      void run('read')
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(invalidate)
  return { snapshot, document, selectedId, selected, graph, otherChapters, dirty, validation, busy, error, canUndo, canRedo, dispatch, add: (type: FlowNodeKind) => dispatch({ type: 'add-node', node: createFlowNode(type) }), undo: () => travel('undo'), redo: () => travel('redo'), reload: () => run('read'), validate: () => run('validate'), save: () => run('save'), create: (input: { id: string, title: string }) => run('create', input) }
}
