/**
 * Compatibility adapter for Studio's authoring-tool registry.
 *
 * Capability inputs are semantic only. Prompt construction, provider choice,
 * model policy, pricing, and credentials belong to the selected AgentRuntime.
 */

import type {
  AgentCapabilityId,
  AgentCapabilityInputMap,
  AgentCapabilityInvocation,
  AgentCapabilityMeta,
  AgentRun,
  AgentRuntime,
} from '@advjs/agent'
import {
  AGENT_CAPABILITY_META,
  getAgentCapability,
  invokeAgentCapability,
  listAgentCapabilities,
} from '@advjs/agent'

export type AgentToolId = AgentCapabilityId
export type AgentToolCategory = AgentCapabilityMeta['category']
export type AgentToolMeta = AgentCapabilityMeta
export type AgentToolInputMap = AgentCapabilityInputMap

export const AGENT_TOOL_META = AGENT_CAPABILITY_META

export function listAgentTools(): AgentToolMeta[] {
  return listAgentCapabilities()
}

export function getAgentTool(id: string): AgentToolMeta | undefined {
  return getAgentCapability(id)
}

export function invokeAgentTool<K extends AgentToolId>(
  runtime: AgentRuntime,
  id: K,
  invocation: AgentCapabilityInvocation<K>,
): Promise<AgentRun> {
  if (!getAgentCapability(id))
    return Promise.reject(new Error(`Unknown agent tool: ${String(id)}`))
  return invokeAgentCapability(runtime, id, invocation)
}
