import type { FlowEditDocument } from '@advjs/core'
import type { AdvProjectDiagnostic, RuntimeAddress, RuntimeProgram } from '@advjs/types'
import type { MaybeRefOrGetter } from 'vue'
import { useAdvContext } from '@advjs/client'
import { computed, onBeforeUnmount, ref, shallowRef, toValue, watch } from 'vue'
import { resolveBrowserPreviewConfig } from '../adapters/browser/preview'
import { useGameStore } from '../stores/useGameStore'
import { useProjectStore } from '../stores/useProjectStore'
import { compileNativeFlowPreview, nativeFlowPreviewSnapshot } from '../utils/native-flow-preview'

export interface NativeFlowPreviewOptions {
  path: MaybeRefOrGetter<string>
  document: MaybeRefOrGetter<FlowEditDocument | undefined>
  selectedNodeId: MaybeRefOrGetter<string>
  selectedLineId?: MaybeRefOrGetter<string | undefined>
}

export function useNativeFlowPreview(options: NativeFlowPreviewOptions) {
  const project = useProjectStore()
  const game = useGameStore()
  const { $adv } = useAdvContext()
  const pending = ref(false)
  const error = ref('')
  const diagnostics = shallowRef<AdvProjectDiagnostic[]>([])
  const selected = shallowRef<RuntimeAddress>()
  let sequence = 0
  const unavailableReason = computed(() => {
    if (typeof window !== 'undefined' && window.advDesktop)
      return '桌面版请先保存，再使用隔离的游戏预览；此处不会加载未保存草稿'
    if (!project.workspace)
      return '请先打开项目工作区'
    if (game.curAdapter !== 'default')
      return '原生 Flow 草稿需要使用默认游戏配置适配器'
    return ''
  })
  const available = computed(() => !unavailableReason.value && !!project.project && !!toValue(options.document) && !!toValue(options.selectedNodeId))
  const inputs = () => [project.workspace, project.project, toValue(options.path), toValue(options.document), toValue(options.selectedNodeId), toValue(options.selectedLineId)] as const
  watch(inputs, () => {
    sequence++
    pending.value = false
    error.value = ''
    diagnostics.value = []
    selected.value = undefined
  }, { flush: 'sync' })
  onBeforeUnmount(() => {
    sequence++
  })

  async function preview(): Promise<boolean> {
    if (!available.value) {
      error.value = unavailableReason.value || '请先选择要预览的草稿节点'
      return false
    }
    const request = ++sequence
    const [workspace, model, path, document, nodeId, lineId] = inputs()
    const selection = { document: document!, nodeId, lineId }
    const isCurrent = () => request === sequence && available.value
    pending.value = true
    error.value = ''
    diagnostics.value = []
    selected.value = undefined
    try {
      // readDocuments does not replace the project or revoke its live media URLs.
      const files = workspace!.readDocuments ? (await workspace!.readDocuments()).files : { ...model!.files }
      if (!isCurrent())
        return false
      const result = await compileNativeFlowPreview({ ...selection, files, path })
      if (!isCurrent())
        return false
      diagnostics.value = result.diagnostics
      if (!result.config) {
        error.value = '草稿未通过校验；请先修复错误后重试'
        return false
      }
      const config = await resolveBrowserPreviewConfig({
        compilation: result.compilation,
        files: result.files,
        filePaths: [...new Set([...(model!.filePaths ?? Object.keys(files)), ...Object.keys(result.files)])],
        mode: 'standard-markdown',
        previewConfig: result.config,
      }, async (path) => {
        if (!isCurrent())
          throw new Error('ADV_FLOW_PREVIEW_CANCELLED')
        if (!workspace!.assetUrl)
          throw new Error('ADV_FLOW_PREVIEW_ASSET_UNAVAILABLE: Workspace cannot resolve preview media')
        return await workspace!.assetUrl(path)
      })
      if (!isCurrent() || !await game.loadGameFromConfig(config, { isCurrent, start: false, persistence: false }) || !isCurrent())
        return false
      const program = $adv.store.program as RuntimeProgram | undefined
      if (!program)
        throw new Error('ADV_FLOW_PREVIEW_PROGRAM_MISSING: The game did not initialize')
      const restored = nativeFlowPreviewSnapshot(program, $adv.runtime.snapshot(), selection, config.variables)
      $adv.runtime.restore(restored.snapshot)
      selected.value = restored.selected
      game.flowDraftPreview = { path, ...restored.selected }
      diagnostics.value = [...result.diagnostics, ...restored.diagnostics.map(issue => ({ ...issue, path }))]
      return true
    }
    catch (failure) {
      if (isCurrent())
        error.value = failure instanceof Error ? failure.message : String(failure)
      return false
    }
    finally {
      if (request === sequence)
        pending.value = false
    }
  }
  return { available, unavailableReason, pending, error, diagnostics, selected, preview }
}
