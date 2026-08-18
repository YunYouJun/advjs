import type {
  AgentCapabilityId,
  AgentProjectContext,
  AgentRun,
  AgentRuntime,
} from '../core/contracts'

export type AgentCapabilityCategory = 'planning' | 'drafting' | 'review'

export interface AgentCapabilityMeta {
  id: AgentCapabilityId
  category: AgentCapabilityCategory
  name: string
  description: string
  streaming: boolean
}

export interface GenerateOutlineInput {
  hint?: string
  premise?: string
}

export interface GenerateChapterDraftInput {
  chapterPath: string
  hint?: string
}

export interface SuggestPlotInput {
  chapterPath: string
  hint?: string
  recentEvents?: readonly string[]
}

export interface SimulateRoleplayInput {
  characterIds: readonly string[]
  goal: string
  rounds?: number
}

export interface CheckConsistencyInput {
  chapterPath: string
}

export interface AgentCapabilityInputMap {
  'generate-outline': GenerateOutlineInput
  'generate-chapter-draft': GenerateChapterDraftInput
  'suggest-plot': SuggestPlotInput
  'simulate-roleplay': SimulateRoleplayInput
  'check-consistency': CheckConsistencyInput
}

export const AGENT_CAPABILITY_META: Readonly<Record<AgentCapabilityId, AgentCapabilityMeta>> = Object.freeze({
  'generate-outline': {
    id: 'generate-outline',
    category: 'planning',
    name: 'Generate Story Outline',
    description: 'Produce a multi-chapter outline from the current project sources.',
    streaming: true,
  },
  'generate-chapter-draft': {
    id: 'generate-chapter-draft',
    category: 'drafting',
    name: 'Draft Chapter Body',
    description: 'Draft AdvScript for a chapter using server-selected project context.',
    streaming: true,
  },
  'suggest-plot': {
    id: 'suggest-plot',
    category: 'planning',
    name: 'Suggest Plot Branches',
    description: 'Suggest distinct plot directions from the current chapter state.',
    streaming: false,
  },
  'simulate-roleplay': {
    id: 'simulate-roleplay',
    category: 'drafting',
    name: 'Simulate Roleplay',
    description: 'Simulate selected project characters toward an author-defined goal.',
    streaming: true,
  },
  'check-consistency': {
    id: 'check-consistency',
    category: 'review',
    name: 'Check Chapter Consistency',
    description: 'Audit a chapter for continuity and character consistency.',
    streaming: false,
  },
})

export interface AgentCapabilityInvocation<K extends AgentCapabilityId> {
  clientRequestId: string
  input: AgentCapabilityInputMap[K]
  locale: string
  project: AgentProjectContext
}

export function listAgentCapabilities(): AgentCapabilityMeta[] {
  return Object.values(AGENT_CAPABILITY_META)
    .slice()
    .sort((left, right) => left.category === right.category
      ? left.id.localeCompare(right.id)
      : left.category.localeCompare(right.category))
}

export function getAgentCapability(id: string): AgentCapabilityMeta | undefined {
  return (AGENT_CAPABILITY_META as Readonly<Record<string, AgentCapabilityMeta>>)[id]
}

export function invokeAgentCapability<K extends AgentCapabilityId>(
  runtime: AgentRuntime,
  capability: K,
  invocation: AgentCapabilityInvocation<K>,
): Promise<AgentRun> {
  return runtime.start<AgentCapabilityInputMap[K]>({
    capability,
    clientRequestId: invocation.clientRequestId,
    input: invocation.input,
    locale: invocation.locale,
    project: invocation.project,
  })
}
