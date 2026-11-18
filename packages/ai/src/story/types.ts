import type { AdvProjectCompileResult, AdvProjectSource, JsonObject, RuntimeAddress, RuntimeProgram } from '@advjs/types'
import type { ChatEndpoint, streamChat } from '../chat'

/** The language a run writes in. It follows the site and stays fixed for the run. */
export type StoryLocale = 'zh' | 'en'

/** Built-in variable actions a generated segment may use. */
export type StoryActionType
  = | 'variables/set'
    | 'variables/increment'
    | 'variables/decrement'
    | 'variables/push-unique'
    | 'variables/remove'

export interface StoryVariableRule {
  /** Actions the model may apply to this key. Empty for host-owned variables. */
  actions: readonly StoryActionType[]
  /** Largest `by` for increment and decrement. @default 1 */
  maxStep?: number
  /** Numbers are clamped into this range between segments. */
  range?: readonly [min: number, max: number]
  /** Arrays keep only their newest entries between segments. */
  keep?: number
}

/** Lengths in Unicode code points. */
export interface StoryLimits {
  title: number
  plotSummary: number
  /** Narration and dialogue of one segment, together. */
  text: number
  /** Longest string value per variable key. */
  values: Record<string, number>
}

/** What a kind of story allows. Plain data, so the same mode runs in a browser or in Node. */
export interface StoryModeSpec {
  id: string
  /** Chapter id of the n-th generated segment, starting at 1. */
  chapterId: (index: number) => string
  choices: { min: number, max: number, optional?: boolean }
  /** Runtime nodes per segment, not counting its anchor and end. */
  maxNodes: number
  limits: Record<StoryLocale, StoryLimits>
  variables: Record<string, StoryVariableRule>
  /** Host-owned values for the segment about to be written, e.g. `{ stop: index }`. */
  engine?: (index: number, variables: JsonObject) => JsonObject
  /** Mode rules for the system prompt, in English. */
  rules: string
  /** Seed files shown to the model as examples of voice and format. */
  examples: readonly string[]
  temperature?: number
  maxTokens?: number
}

export interface PlayerChoiceAction {
  kind: 'choice'
  /** Chapter whose choice block the player answered. */
  chapterId: string
  choiceId: string
  label: string
}

export type PlayerAction = PlayerChoiceAction

export interface StoryProblem {
  code: string
  message: string
  /** Line in the segment file. */
  line?: number
}

export interface SegmentResult {
  index: number
  chapterId: string
  /** Project-relative file path, `adv/chapters/<chapterId>/01.adv.md`. */
  path: string
  source: string
  title: string
  plotSummary: string
  /** Model calls it took, counting the repair. */
  attempts: number
  /** The model's output never passed, so the mode's fallback segment stands in. */
  fallback: boolean
  /** What was wrong with the last rejected attempt. */
  problems: StoryProblem[]
  /** Variables the segment starts with: the player's, bounded, plus host-owned values. */
  variables: JsonObject
}

export interface SegmentRecord extends SegmentResult {
  action: PlayerAction
}

export interface CompiledStory {
  result: AdvProjectCompileResult
  program: RuntimeProgram
}

export interface AcceptedSegment extends CompiledStory {
  segment: SegmentRecord
  /** Where the new segment starts. */
  entry: RuntimeAddress
  /** Variables to start its runtime with. */
  variables: JsonObject
}

export interface StoryUsage {
  promptTokens: number
  completionTokens: number
  /** Some calls reported no usage, so part of the total is estimated from text length. */
  estimated: boolean
}

export interface GenerateHooks {
  signal?: AbortSignal
  /** The reply so far, each time it grows. Starts over on a repair attempt. */
  onText?: (text: string, attempt: number) => void
  /** The first attempt failed the checks; a repair request is on its way. */
  onRepair?: (problems: StoryProblem[]) => void
}

export interface StorySessionOptions {
  mode: StoryModeSpec
  locale: StoryLocale
  /** Program id, e.g. `endless-tram-1730000000`. Every segment of a run compiles under it. */
  projectId: string
  /** The seed project: `adv.config.json`, `adv/…`. Must contain an `unwritten` chapter. */
  seedFiles: Record<string, string>
  /** Segment used when the model's output fails twice; its title line has no anchor. */
  fallback: string
  chat: ChatEndpoint
  compile: (source: AdvProjectSource) => Promise<AdvProjectCompileResult>
  /** Swaps the transport, for tests. @default streamChat */
  stream?: typeof streamChat
}
