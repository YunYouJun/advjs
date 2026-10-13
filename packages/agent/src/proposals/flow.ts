import type { FlowProposalPlan, ProjectSourcePatch } from '@advjs/core'
import type { AdvProjectCompileOptions, AdvProjectFileMap, JsonValue } from '@advjs/types'
import type { AgentProposalCandidate } from './candidate'
import type { AgentProposalReview } from './review'
import { planFlowProposal } from '@advjs/core'
import { AgentProposalReviewService, computeAgentProjectRevision } from './review'

export interface FlowProposalReviewResult {
  plan: FlowProposalPlan
  /** Invalid drafts retain their diff and diagnostics, but have no accepted review. */
  review?: AgentProposalReview
}

/**
 * Adapt trusted command output to the existing review contract without adding a
 * writer, model call, new story format, or publication path. Consumers may load
 * plan.proposed into an Editor draft; saving remains an explicit author action.
 */
export async function createFlowProposalReview(input: {
  files: AdvProjectFileMap
  request: unknown
  projectId: string
  taskId?: string
  summary?: string
  options?: AdvProjectCompileOptions
}): Promise<FlowProposalReviewResult> {
  const files = Object.freeze({ ...input.files })
  const plan = await planFlowProposal({ files, request: input.request, options: input.options })
  if (!plan.valid)
    return { plan }
  const reviewRevision = await computeAgentProjectRevision(files)
  const patches: ProjectSourcePatch[] = []
  for (const key of ['title', 'nodes', 'startNodeId'] as const) {
    if (JSON.stringify(plan.baseline[key]) !== JSON.stringify(plan.proposed[key])) {
      patches.push({ kind: 'json-set', path: plan.path, key, value: plan.proposed[key] as unknown as JsonValue })
    }
  }
  const candidate: AgentProposalCandidate = {
    taskId: input.taskId ?? `flow-proposal:${plan.chapterId}`,
    projectId: input.projectId,
    proposal: {
      summary: input.summary ?? `Review proposed edits to ${plan.chapterId}`,
      projectRevision: reviewRevision,
      patches,
      diagnostics: plan.diagnostics,
    },
    // This adapter is a local review only. It does not imply model usage or a charge.
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, providerCostMicroCny: 0, chargedMicroPoints: 0 },
  }
  const unavailable = async (): Promise<never> => {
    throw new Error('Flow proposal review is read-only; load the reviewed plan into an Editor draft')
  }
  const service = new AgentProposalReviewService({
    snapshot: async () => ({ projectId: input.projectId, revision: reviewRevision, files }),
    commit: unavailable,
    restore: unavailable,
  })
  const review = await service.review(candidate)
  return { plan, review }
}
