import type { AgentProposal, AgentResult, AgentUsageSummary } from '../core/contracts'

export interface AgentProposalCandidate {
  taskId: string
  projectId?: string
  proposal: AgentProposal
  usage: AgentUsageSummary
}

export function toAgentProposalCandidate(
  result: AgentResult,
  projectId?: string,
): AgentProposalCandidate | undefined {
  if (!result.proposal)
    return undefined
  return {
    taskId: result.taskId,
    ...(projectId ? { projectId } : {}),
    proposal: result.proposal,
    usage: result.usage,
  }
}
