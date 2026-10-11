import type { FlowAuthoringSnapshot, FlowEditCommand, FlowEditDocument, FlowEditHistory } from '@advjs/core'
import type { AdvProjectDiagnostic } from '@advjs/types'
import { createFlowAuthoringService, createFlowEditHistory, createFlowNode, flowDocumentRevision, flowDocumentsFromFiles, reduceFlowEditHistory, serializeFlowDocument } from '@advjs/core'
import { computed, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue'
import { useProjectDrafts } from '../stores/useProjectDrafts'
import { useProjectStore } from '../stores/useProjectStore'

interface FlowDraft { snapshot: FlowAuthoringSnapshot, history: FlowEditHistory }

export function useNativeFlowAuthoring() {
  const project = useProjectStore()
  const draftStore = useProjectDrafts()
  const id = useId()
  const path = ref('')
  const selectedNodeId = ref('')
  const drafts = shallowRef(new Map<string, FlowDraft>())
  const diagnostics = shallowRef<AdvProjectDiagnostic[]>([])
  const error = ref('')
  const status = ref('')
  const loading = ref(false)
  const saving = ref(false)
  let validationSequence = 0
  let loadSequence = 0
  const chapterPaths = computed(() => [...new Set([...Object.keys(project.project?.files ?? {}).filter(path => path.endsWith('.chapter.json')), ...drafts.value.keys()])].sort())
  const current = computed(() => drafts.value.get(path.value))
  const document = computed(() => current.value?.history.present)
  const selectedNode = computed(() => document.value?.nodes.find(node => node.id === selectedNodeId.value))
  const dirty = computed(() => Boolean(current.value && (JSON.stringify(current.value.history.present) !== JSON.stringify(current.value.snapshot.document) || current.value.snapshot.content === null)))
  const anyDirty = computed(() => [...drafts.value.values()].some(draft => JSON.stringify(draft.history.present) !== JSON.stringify(draft.snapshot.document) || draft.snapshot.content === null))
  const conflict = computed(() => Boolean(current.value && (project.project?.files[path.value] ?? null) !== current.value.snapshot.content))
  const writable = computed(() => Boolean(project.workspace?.writeFiles))
  const canSave = computed(() => writable.value && dirty.value && !conflict.value && !saving.value && !loading.value && !diagnostics.value.some(issue => issue.severity === 'error'))

  function service() {
    const workspace = project.workspace
    if (!workspace?.writeFiles)
      throw new Error('ADV_FLOW_READ_ONLY: 此工作区不支持原生文件保存')
    return createFlowAuthoringService({
      readFiles: async () => workspace.readDocuments ? (await workspace.readDocuments()).files : (await workspace.snapshot()).project.files,
      writeFiles: (changes) => {
        if (project.workspace !== workspace)
          throw new Error('ADV_FLOW_WORKSPACE_CHANGED: 保存期间项目已改变；草稿未写入新项目')
        return project.writeProjectFiles(changes)
      },
    })
  }
  function put(path: string, draft: FlowDraft) {
    drafts.value = new Map(drafts.value).set(path, draft)
  }
  async function validate() {
    const currentDocument = document.value
    if (!currentDocument)
      return
    const sequence = ++validationSequence
    try {
      const authoring = service()
      const input = { path: path.value, document: currentDocument }
      const result = current.value?.snapshot.content === null ? await authoring.validateCreate(input) : await authoring.validate(input)
      if (sequence === validationSequence)
        diagnostics.value = result.diagnostics
    }
    catch (failure) {
      if (sequence === validationSequence)
        diagnostics.value = [{ code: 'ADV_FLOW_VALIDATION_ERROR', severity: 'error', message: failure instanceof Error ? failure.message : String(failure), path: path.value }]
    }
  }
  async function open(nextPath: string, reload = false) {
    path.value = nextPath
    const sequence = ++loadSequence
    error.value = ''
    status.value = ''
    if (!drafts.value.has(nextPath) || reload) {
      loading.value = true
      try {
        const snapshot = await service().read(nextPath)
        if (sequence !== loadSequence)
          return
        put(nextPath, { snapshot, history: createFlowEditHistory(snapshot.document) })
      }
      catch (failure) {
        if (sequence === loadSequence)
          error.value = failure instanceof Error ? failure.message : String(failure)
      }
      finally {
        if (sequence === loadSequence)
          loading.value = false
      }
    }
    selectedNodeId.value = document.value?.nodes[0]?.id ?? ''
    await validate()
  }
  function edit(command: FlowEditCommand) {
    if (!current.value || saving.value)
      return
    error.value = ''
    status.value = ''
    try {
      const otherChapters = flowDocumentsFromFiles(project.project?.files ?? {}).filter(chapter => chapter.id !== document.value?.id)
      const history = reduceFlowEditHistory(current.value.history, { type: 'edit', command, context: { otherChapters } })
      put(path.value, { ...current.value, history })
      if (command.type === 'add-node')
        selectedNodeId.value = command.node.id
      if (!document.value?.nodes.some(node => node.id === selectedNodeId.value))
        selectedNodeId.value = document.value?.nodes[0]?.id ?? ''
      void validate()
    }
    catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  }
  function history(action: 'undo' | 'redo') {
    if (!current.value)
      return
    put(path.value, { ...current.value, history: reduceFlowEditHistory(current.value.history, action === 'undo' ? { type: 'undo' } : { type: 'redo' }) })
    error.value = ''
    void validate()
  }
  async function save(): Promise<boolean> {
    if (!current.value || !writable.value || saving.value)
      return false
    const draft = current.value
    const selectedPath = path.value
    const workspace = project.workspace
    saving.value = true
    error.value = ''
    try {
      const authoring = service()
      const input = { path: selectedPath, document: draft.history.present, expectedRevision: draft.snapshot.revision }
      const snapshot = draft.snapshot.content === null ? await authoring.create(input) : await authoring.save(input)
      if (project.workspace !== workspace)
        return false
      put(selectedPath, { snapshot, history: draft.history })
      status.value = 'JSON 章节已保存'
      await validate()
      return true
    }
    catch (failure) {
      if (project.workspace === workspace)
        error.value = failure instanceof Error ? failure.message : String(failure)
      return false
    }
    finally {
      if (project.workspace === workspace)
        saving.value = false
    }
  }
  async function createChapter(chapterId: string, title: string) {
    const workspace = project.workspace
    const root = project.project?.compilation.project.root ?? 'adv'
    const nextPath = `${root}/chapters/${chapterId}.chapter.json`
    if (chapterPaths.value.includes(nextPath)) {
      error.value = 'ADV_FLOW_FILE_EXISTS: 章节已存在'
      return
    }
    const start = createFlowNode('start')
    const end = createFlowNode('end')
    start.next = end.id
    const document: FlowEditDocument = { schemaVersion: 1, id: chapterId, title, startNodeId: start.id, nodes: [start, end] }
    try {
      // Structural validation happens in history before the draft enters the workspace.
      serializeFlowDocument(document)
      const revision = await flowDocumentRevision(null)
      if (project.workspace !== workspace)
        return
      put(nextPath, { snapshot: { path: nextPath, content: null, revision, document }, history: createFlowEditHistory(document) })
      await open(nextPath)
    }
    catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  }
  watch(() => project.workspace, () => {
    loadSequence++
    validationSequence++
    drafts.value = new Map()
    path.value = ''
    selectedNodeId.value = ''
    loading.value = false
    saving.value = false
    error.value = ''
    diagnostics.value = []
    const first = chapterPaths.value[0]
    if (first)
      void open(first)
  }, { immediate: true })
  watch(() => project.project?.files[path.value], () => {
    if (current.value && !dirty.value && !saving.value)
      void open(path.value, true)
  })
  watch(anyDirty, value => draftStore.register(id, { dirty: value, save: async () => {
    const original = path.value
    for (const [draftPath, draft] of drafts.value) {
      if (JSON.stringify(draft.history.present) !== JSON.stringify(draft.snapshot.document) || draft.snapshot.content === null) {
        path.value = draftPath
        if (!await save())
          return false
      }
    }
    path.value = original
    return true
  } }), { immediate: true })
  onBeforeUnmount(() => {
    validationSequence++
    loadSequence++
    draftStore.remove(id)
  })
  return { path, chapterPaths, document, selectedNodeId, selectedNode, current, dirty, conflict, writable, canSave, diagnostics, error, status, loading, saving, open, edit, history, save, createChapter }
}
