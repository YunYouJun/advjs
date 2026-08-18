import type { AgentProposalCandidate } from '../agent/proposals/candidate'
import type {
  AgentProjectWorkspace,
  AgentProposalReview,
  AgentProposalReviewErrorCode,
  AppliedAgentProposal,
} from '../agent/proposals/review'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AgentProposalReviewError, AgentProposalReviewService } from '../agent/proposals/review'

export interface AgentProposalUiError {
  code: AgentProposalReviewErrorCode | 'workspace_unavailable' | 'unknown'
  diagnostics: readonly { code: string, message: string, path?: string }[]
}

export const useAgentProposalStore = defineStore('agent-proposal', () => {
  const candidate = ref<AgentProposalCandidate>()
  const review = ref<AgentProposalReview>()
  const applied = ref<AppliedAgentProposal>()
  const error = ref<AgentProposalUiError>()
  const isReviewing = ref(false)
  const isApplying = ref(false)
  const isUndoing = ref(false)
  const isOpen = ref(false)

  let service: AgentProposalReviewService | undefined
  let onWorkspaceChanged: (() => Promise<void> | void) | undefined

  const canApply = computed(() => Boolean(
    review.value?.files.length
    && !applied.value
    && !error.value
    && !isApplying.value,
  ))
  const canUndo = computed(() => Boolean(applied.value && !isUndoing.value))

  function configure(
    workspace: AgentProjectWorkspace,
    options: { onWorkspaceChanged?: () => Promise<void> | void } = {},
  ): void {
    service = new AgentProposalReviewService(workspace)
    onWorkspaceChanged = options.onWorkspaceChanged
    error.value = undefined
  }

  function disconnect(): void {
    service = undefined
    onWorkspaceChanged = undefined
    candidate.value = undefined
    review.value = undefined
    applied.value = undefined
    error.value = undefined
    isReviewing.value = false
    isApplying.value = false
    isUndoing.value = false
    isOpen.value = false
  }

  function uiError(cause: unknown): AgentProposalUiError {
    if (cause instanceof AgentProposalReviewError) {
      return {
        code: cause.code,
        diagnostics: cause.diagnostics.map(item => ({
          code: item.code,
          message: item.message,
          ...(item.path ? { path: item.path } : {}),
        })),
      }
    }
    return { code: 'unknown', diagnostics: [] }
  }

  async function offer(next: AgentProposalCandidate): Promise<void> {
    if (candidate.value?.taskId === next.taskId && review.value)
      return
    candidate.value = next
    review.value = undefined
    applied.value = undefined
    error.value = undefined
    isOpen.value = true
    if (!service) {
      error.value = { code: 'workspace_unavailable', diagnostics: [] }
      return
    }
    await reviewCandidate(next)
  }

  async function reviewCandidate(next: AgentProposalCandidate): Promise<void> {
    if (!service)
      return
    isReviewing.value = true
    try {
      review.value = await service.review(next)
    }
    catch (cause) {
      error.value = uiError(cause)
    }
    finally {
      isReviewing.value = false
    }
  }

  async function refreshReview(): Promise<void> {
    if (!candidate.value || !service)
      return
    review.value = undefined
    error.value = undefined
    await reviewCandidate(candidate.value)
  }

  async function apply(): Promise<void> {
    if (!service || !review.value || isApplying.value)
      return
    isApplying.value = true
    error.value = undefined
    try {
      applied.value = await service.apply(review.value)
      await onWorkspaceChanged?.()
    }
    catch (cause) {
      error.value = uiError(cause)
    }
    finally {
      isApplying.value = false
    }
  }

  async function undo(): Promise<void> {
    if (!service || !applied.value || isUndoing.value)
      return
    isUndoing.value = true
    error.value = undefined
    try {
      await service.undo(applied.value)
      applied.value = undefined
      review.value = undefined
      if (candidate.value)
        review.value = await service.review(candidate.value)
      await onWorkspaceChanged?.()
    }
    catch (cause) {
      error.value = uiError(cause)
    }
    finally {
      isUndoing.value = false
    }
  }

  function open(): void {
    if (candidate.value)
      isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  return {
    candidate,
    review,
    applied,
    error,
    isReviewing,
    isApplying,
    isUndoing,
    isOpen,
    canApply,
    canUndo,
    configure,
    disconnect,
    offer,
    refreshReview,
    apply,
    undo,
    open,
    close,
  }
})
