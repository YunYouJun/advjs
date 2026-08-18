import type { AgentCapabilityId, AgentCapabilityInputMap } from '@advjs/agent'
import type { AdvProjectFileMap } from '@advjs/types'
import { computeAgentProjectRevision, selectManagedAgentProjectFiles } from '@advjs/agent'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useManagedAgentStore } from '../stores/useManagedAgentStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useProjectContent } from './useProjectContent'

export type ManagedAuthoringStartErrorCode
  = | 'service_unavailable'
    | 'task_active'
    | 'project_unavailable'
    | 'saved_source_required'
    | 'invalid_input'
    | 'start_failed'

export class ManagedAuthoringStartError extends Error {
  constructor(readonly code: ManagedAuthoringStartErrorCode, options: { cause?: unknown } = {}) {
    super(code, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ManagedAuthoringStartError'
  }
}

function entriesToFileMap(entries: readonly { content: string, path: string }[]): AdvProjectFileMap {
  return Object.fromEntries(
    entries
      .map(entry => [entry.path, entry.content] as const)
      .sort(([left], [right]) => left.localeCompare(right, 'en')),
  )
}

function clientRequestId(): string {
  return globalThis.crypto.randomUUID()
}

/** Starts one of Studio's server-managed authoring capabilities against the saved project baseline. */
export function useManagedAuthoring() {
  const managedStore = useManagedAgentStore()
  const studioStore = useStudioStore()
  const projectContent = useProjectContent()
  const { locale } = useI18n()
  const { isConfigured, canStartTask, hasActiveTask } = storeToRefs(managedStore)
  const isSubmitting = ref(false)
  const errorCode = ref<ManagedAuthoringStartErrorCode>()

  function clearError(): void {
    errorCode.value = undefined
  }

  async function start<K extends AgentCapabilityId>(
    capability: K,
    input: AgentCapabilityInputMap[K],
  ): Promise<string> {
    clearError()
    if (!isConfigured.value)
      throw setError('service_unavailable')
    if (hasActiveTask.value || !canStartTask.value)
      throw setError('task_active')

    const project = studioStore.currentProject
    if (!project || project.source === 'cos')
      throw setError('project_unavailable')

    isSubmitting.value = true
    try {
      await projectContent.whenReady()
      const fs = projectContent.getFs()
      if (!fs)
        throw new ManagedAuthoringStartError('project_unavailable')
      const allFiles = entriesToFileMap(await fs.collectAllFiles())
      let files: AdvProjectFileMap
      try {
        files = selectManagedAgentProjectFiles(capability, input, allFiles)
      }
      catch (cause) {
        throw new ManagedAuthoringStartError('saved_source_required', { cause })
      }
      return await managedStore.startTask({
        capability,
        clientRequestId: clientRequestId(),
        input,
        locale: locale.value,
        project: {
          id: project.projectId,
          revision: await computeAgentProjectRevision(allFiles),
          files,
        },
      })
    }
    catch (cause) {
      if (cause instanceof ManagedAuthoringStartError) {
        errorCode.value = cause.code
        throw cause
      }
      throw setError('start_failed', cause)
    }
    finally {
      isSubmitting.value = false
    }
  }

  function setError(code: ManagedAuthoringStartErrorCode, cause?: unknown): ManagedAuthoringStartError {
    errorCode.value = code
    return new ManagedAuthoringStartError(code, { cause })
  }

  return {
    isConfigured,
    canStartTask,
    hasActiveTask,
    isSubmitting,
    errorCode,
    clearError,
    start,
  }
}
