import type { FlowAuthoringSnapshot, FlowEditCommand, FlowEditDocument, FlowEditHistory } from '@advjs/core'
import type { AdvProjectDiagnostic } from '@advjs/types'
import { createFlowAuthoringService, createFlowEditHistory, createFlowNode, flowDocumentRevision, flowDocumentsFromFiles, flowProjectRevision, parseFlowDocument, reduceFlowEditHistory, serializeFlowDocument } from '@advjs/core'
import { computed, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue'
import { computeAgentProjectRevision, createFlowProposalReview } from '../../../../packages/agent/src/proposals'
import { useProjectDrafts } from '../stores/useProjectDrafts'
import { useProjectStore } from '../stores/useProjectStore'

interface FlowDraft { snapshot: FlowAuthoringSnapshot, history: FlowEditHistory, proposalRevision?: string }

export function useNativeFlowAuthoring() {
  const project = useProjectStore()
  const draftStore = useProjectDrafts()
  const id = useId()
  const path = ref('')
  const selectedNodeId = ref('')
  const selectedLineId = ref<string>()
  watch(selectedNodeId, () => {
    selectedLineId.value = undefined
  }, { flush: 'sync' })
  const drafts = shallowRef(new Map<string, FlowDraft>())
  const diagnostics = shallowRef<AdvProjectDiagnostic[]>([])
  const error = ref('')
  const status = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const pendingReload = shallowRef<{ path: string, draft: FlowDraft }>()
  const proposal = shallowRef<Awaited<ReturnType<typeof createFlowProposalReview>>>()
  let proposalSequence = 0
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

  function service(expectedProjectRevision?: string) {
    const workspace = project.workspace
    if (!workspace?.writeFiles)
      throw new Error('ADV_FLOW_READ_ONLY: 此工作区不支持原生文件保存')
    return createFlowAuthoringService({
      readFiles: async () => {
        const files = workspace.readDocuments ? (await workspace.readDocuments()).files : (await workspace.snapshot()).project.files
        if (expectedProjectRevision && await computeAgentProjectRevision(files) !== expectedProjectRevision)
          throw new Error('ADV_FLOW_SOURCE_CONFLICT: 提案基线已改变；草稿保留，请重新比较项目版本')
        return files
      },
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
    if (saving.value)
      return
    pendingReload.value = undefined
    proposal.value = undefined
    path.value = nextPath
    const sequence = ++loadSequence
    error.value = ''
    status.value = ''
    validationSequence++
    diagnostics.value = []
    loading.value = false
    if (!drafts.value.has(nextPath) || reload || (!dirty.value && conflict.value)) {
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
    if (sequence !== loadSequence)
      return
    selectedNodeId.value = document.value?.nodes[0]?.id ?? ''
    await validate()
  }
  async function requestReload() {
    if (!current.value || loading.value || saving.value)
      return
    if (dirty.value) {
      pendingReload.value = { path: path.value, draft: current.value }
      return
    }
    await open(path.value, true)
  }
  function cancelReload() {
    pendingReload.value = undefined
  }
  async function confirmReload() {
    const request = pendingReload.value
    pendingReload.value = undefined
    // Approval only covers the draft that was shown, not a later edit or project.
    if (!request || request.path !== path.value || request.draft !== current.value || saving.value)
      return
    if (request.draft.snapshot.content === null) {
      const remaining = new Map(drafts.value)
      remaining.delete(request.path)
      drafts.value = remaining
      const nextPath = chapterPaths.value[0]
      if (nextPath) {
        await open(nextPath)
      }
      else {
        path.value = ''
        selectedNodeId.value = ''
        validationSequence++
        diagnostics.value = []
        error.value = ''
        status.value = ''
      }
      return
    }
    await open(request.path, true)
  }
  function edit(command: FlowEditCommand) {
    if (!current.value || saving.value || loading.value)
      return
    error.value = ''
    status.value = ''
    try {
      const otherChapters = command.type === 'delete-node'
        ? flowDocumentsFromFiles(project.project?.files ?? {}).filter(chapter => chapter.id !== document.value?.id)
        : []
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
    if (!current.value || saving.value || loading.value)
      return
    put(path.value, { ...current.value, history: reduceFlowEditHistory(current.value.history, action === 'undo' ? { type: 'undo' } : { type: 'redo' }) })
    error.value = ''
    void validate()
  }
  async function save(): Promise<boolean> {
    if (!current.value || !writable.value || saving.value || loading.value)
      return false
    const draft = current.value
    const selectedPath = path.value
    const workspace = project.workspace
    saving.value = true
    error.value = ''
    try {
      const authoring = service(draft.proposalRevision)
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
  function dismissProposal() {
    proposalSequence++
    proposal.value = undefined
  }
  async function proposalTemplate(): Promise<string> {
    const workspace = project.workspace
    const draft = current.value
    const selectedPath = path.value
    if (!workspace || !draft || dirty.value || saving.value || loading.value)
      throw new Error('请先保存或放弃当前草稿')
    const files = workspace.readDocuments ? (await workspace.readDocuments()).files : (await workspace.snapshot()).project.files
    const projectRevision = await flowProjectRevision(files)
    if (workspace !== project.workspace || draft !== current.value || selectedPath !== path.value || dirty.value)
      throw new Error('项目或草稿已改变，请重试')
    if ((files[selectedPath] ?? null) !== draft.snapshot.content)
      throw new Error('项目源文件已改变，请载入项目版本')
    return JSON.stringify({ schemaVersion: 1, path: selectedPath, expectedRevision: draft.snapshot.revision, projectRevision, commands: [] }, null, 2)
  }
  async function reviewProposal(request: unknown) {
    if (!current.value || dirty.value || loading.value || saving.value) {
      error.value = '请先保存或放弃当前草稿，再比较 AI 提案；不会覆盖现有修改。'
      return
    }
    const requestSequence = ++proposalSequence
    const draft = current.value
    const selectedPath = path.value
    const workspace = project.workspace
    const sequence = loadSequence
    loading.value = true
    proposal.value = undefined
    error.value = ''
    try {
      if (!workspace)
        throw new Error('工作区不可用')
      const files = workspace.readDocuments ? (await workspace.readDocuments()).files : (await workspace.snapshot()).project.files
      const reviewed = await createFlowProposalReview({ files, request, projectId: project.project?.compilation.project.id ?? 'editor' })
      if (workspace !== project.workspace || sequence !== loadSequence || requestSequence !== proposalSequence || draft !== current.value)
        return
      if (reviewed.plan.path !== selectedPath || reviewed.plan.revision !== draft.snapshot.revision)
        throw new Error('ADV_FLOW_SOURCE_CONFLICT: 提案必须匹配当前章节和版本')
      proposal.value = reviewed
    }
    catch (failure) {
      if (workspace === project.workspace && sequence === loadSequence && requestSequence === proposalSequence)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (workspace === project.workspace && sequence === loadSequence)
        loading.value = false
    }
  }
  async function loadProposal() {
    const reviewed = proposal.value
    const draft = current.value
    if (!reviewed?.review || !reviewed.plan.valid || !draft || dirty.value || loading.value || saving.value)
      return
    if (!reviewed.plan.changes.nodes.length && !reviewed.plan.changes.chapterFields.length) {
      status.value = '提案没有内容变化'
      return
    }
    const workspace = project.workspace
    const sequence = loadSequence
    loading.value = true
    error.value = ''
    try {
      if (!workspace)
        throw new Error('工作区不可用')
      const files = workspace.readDocuments ? (await workspace.readDocuments()).files : (await workspace.snapshot()).project.files
      if (await computeAgentProjectRevision(files) !== reviewed.review.baseline.revision)
        throw new Error('ADV_FLOW_SOURCE_CONFLICT: 比较后项目已改变；请重新生成提案')
      if (workspace !== project.workspace || sequence !== loadSequence || draft !== current.value || proposal.value !== reviewed)
        return
      // Review is local and trusted; preserve the save snapshot and make application one undo step.
      const present = parseFlowDocument(serializeFlowDocument(reviewed.plan.proposed))
      put(path.value, { ...draft, proposalRevision: reviewed.review.baseline.revision, history: { past: [...draft.history.past, draft.history.present], present, future: [] } })
      const changedLine = reviewed.plan.changes.lines.find(line => line.kind !== 'deleted')
      selectedNodeId.value = changedLine?.nodeId ?? reviewed.plan.changes.nodes.find(node => node.kind !== 'deleted')?.nodeId ?? present.nodes[0]?.id ?? ''
      selectedLineId.value = changedLine?.lineId
      proposal.value = undefined
      status.value = '提案已载入未保存草稿；可微调、试玩或撤销，确认后保存'
      await validate()
    }
    catch (failure) {
      if (workspace === project.workspace && sequence === loadSequence)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (workspace === project.workspace && sequence === loadSequence)
        loading.value = false
    }
  }
  async function createChapter(chapterId: string, title: string) {
    if (saving.value || loading.value)
      return
    const workspace = project.workspace
    const sequence = loadSequence
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
      if (project.workspace !== workspace || sequence !== loadSequence || saving.value || chapterPaths.value.includes(nextPath))
        return
      put(nextPath, { snapshot: { path: nextPath, content: null, revision, document }, history: createFlowEditHistory(document) })
      await open(nextPath)
    }
    catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
  }
  watch(() => project.workspace, () => {
    loadSequence++
    validationSequence++
    pendingReload.value = undefined
    proposal.value = undefined
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
  watch(() => [path.value, project.project?.files[path.value]] as const, ([nextPath, content], [previousPath, previousContent]) => {
    if (nextPath === previousPath && content !== previousContent && current.value && !dirty.value && !saving.value)
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
  return { proposal, proposalTemplate, dismissProposal, reviewProposal, loadProposal, path, chapterPaths, document, selectedNodeId, selectedLineId, selectedNode, current, dirty, conflict, writable, canSave, diagnostics, error, status, loading, saving, pendingReload, requestReload, cancelReload, confirmReload, open, edit, history, save, createChapter }
}
