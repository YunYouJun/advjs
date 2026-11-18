import type { AdvProjectCompileResult, JsonObject, JsonValue, RuntimeChoice } from '@advjs/types'
import type { ChatMessage } from '../chat'
import type { PreparedSegment } from './source'
import type { AcceptedSegment, CompiledStory, GenerateHooks, PlayerAction, SegmentRecord, SegmentResult, StoryProblem, StorySessionOptions, StoryUsage } from './types'
import { streamChat } from '../chat'
import { buildRepairMessage, buildSegmentMessages } from './prompt'
import { linkChoices, prepareSegment, textLength } from './source'
import { validateSegment } from './validate'

/** Every generated run links branches it never wrote to this chapter of the seed. */
export const UNWRITTEN_TARGET = 'unwritten#unwritten'

export interface StorySession {
  /** The run's files: the seed plus every accepted segment, with chosen branches linked. */
  readonly files: Readonly<Record<string, string>>
  readonly segments: readonly SegmentRecord[]
  readonly usage: Readonly<StoryUsage>
  /** Compiles the seed. Call once before playing; throws if the seed is broken. */
  start: () => Promise<CompiledStory>
  /** Writes the next segment for the player's action. Network and auth errors are thrown. */
  generate: (action: PlayerAction, variables: JsonObject, hooks?: GenerateHooks) => Promise<SegmentResult>
  /** Adds a segment to the run and links the answered choice to it. */
  accept: (segment: SegmentResult, action: PlayerAction) => Promise<AcceptedSegment>
}

function errorsOf(result: AdvProjectCompileResult) {
  return result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')
}

function describe(result: AdvProjectCompileResult): string {
  return errorsOf(result).map(error => `${error.path ?? '?'}:${error.line ?? '?'} ${error.code} ${error.message}`).join('\n')
}

export function createStorySession(options: StorySessionOptions): StorySession {
  const { mode, locale, projectId, compile } = options
  const limits = mode.limits[locale]
  const stream = options.stream ?? streamChat
  const files: Record<string, string> = { ...options.seedFiles }
  const segments: SegmentRecord[] = []
  const usage: StoryUsage = { promptTokens: 0, completionTokens: 0, estimated: false }
  let compiled: CompiledStory | undefined

  async function build(map: Record<string, string>): Promise<CompiledStory> {
    const result = await compile({ id: projectId, files: map })
    const program = result.project.program
    if (!program || errorsOf(result).length)
      throw new Error(`Story "${projectId}" does not compile:\n${describe(result)}`)
    return { result, program }
  }

  /** Clamps numbers, trims lists, then sets the host-owned values for segment `index`. */
  function startingVariables(variables: JsonObject, index: number): JsonObject {
    const next: JsonObject = structuredClone(variables)
    for (const [key, rule] of Object.entries(mode.variables)) {
      const value = next[key]
      if (rule.range && typeof value === 'number')
        next[key] = Math.min(rule.range[1], Math.max(rule.range[0], value))
      if (rule.keep !== undefined && Array.isArray(value))
        next[key] = value.slice(-rule.keep) as JsonValue
    }
    return { ...next, ...mode.engine?.(index, next) }
  }

  /** The chapter the player answered and the one before it, in full, for the prompt. */
  function recentFiles(action: PlayerAction) {
    const chapters = compiled!.result.project.chapters
    const at = chapters.findIndex(chapter => chapter.id === action.chapterId)
    const previous = segments.at(-2)
    const paths = [
      ...(previous && previous.chapterId !== action.chapterId ? [previous.path] : []),
      ...(chapters[at]?.sources ?? []),
    ]
    return paths.map(path => ({ path, source: files[path] }))
  }

  async function ask(messages: ChatMessage[], attempt: number, hooks?: GenerateHooks): Promise<string> {
    let text = ''
    let reported = false
    for await (const delta of stream({
      ...options.chat,
      messages,
      temperature: mode.temperature ?? 0.9,
      maxTokens: mode.maxTokens ?? 600,
      signal: hooks?.signal,
      retries: 1,
      onUsage: ({ promptTokens, completionTokens }) => {
        reported = true
        usage.promptTokens += promptTokens
        usage.completionTokens += completionTokens
      },
    })) {
      text += delta
      hooks?.onText?.(text, attempt)
    }
    if (!reported) {
      // Rough: about 1.5 CJK characters or 4 Latin characters per token.
      const perToken = locale === 'zh' ? 1.5 : 4
      usage.promptTokens += Math.ceil(messages.reduce((sum, message) => sum + textLength(message.content), 0) / perToken)
      usage.completionTokens += Math.ceil(textLength(text) / perToken)
      usage.estimated = true
    }
    return text
  }

  async function check(prepared: PreparedSegment, path: string, chapterId: string, variables: JsonObject): Promise<StoryProblem[]> {
    const result = await compile({ id: projectId, files: { ...files, [path]: prepared.source } })
    const errors = errorsOf(result)
    const elsewhere = errors.filter(error => error.path !== path)
    if (elsewhere.length)
      throw new Error(`Story "${projectId}" broke outside the new segment:\n${describe(result)}`)
    return validateSegment({
      prepared,
      chapter: result.project.program?.chapters[chapterId],
      errors,
      mode,
      limits,
      variables,
    })
  }

  return {
    get files() {
      return files
    },
    get segments() {
      return segments
    },
    get usage() {
      return usage
    },

    async start() {
      compiled = await build(files)
      const unwritten = compiled.program.chapters.unwritten
      if (!unwritten?.nodes.unwritten)
        throw new Error(`Seed of "${mode.id}" needs a chapter "unwritten" with the anchor {#unwritten}`)
      return compiled
    },

    async generate(action, variables, hooks) {
      if (!compiled)
        throw new Error('Call start() before generate()')
      const index = segments.length + 1
      const chapterId = mode.chapterId(index)
      const path = `adv/chapters/${chapterId}/01.adv.md`
      const starting = startingVariables(variables, index)
      const messages = buildSegmentMessages({
        mode,
        locale,
        files,
        characters: compiled.result.project.characters,
        segments,
        recent: recentFiles(action),
        variables: starting,
        action,
        index,
      })

      let conversation = messages
      let problems: StoryProblem[] = []
      let attempts = 0
      for (let attempt = 1; attempt <= 2; attempt++) {
        attempts = attempt
        const prepared = prepareSegment(await ask(conversation, attempt, hooks), chapterId)
        problems = await check(prepared, path, chapterId, starting)
        if (!problems.length) {
          return { index, chapterId, path, source: prepared.source, title: prepared.title!, plotSummary: prepared.plotSummary!, attempts, fallback: false, problems: [], variables: starting }
        }
        if (attempt === 1) {
          hooks?.onRepair?.(problems)
          conversation = [...messages, { role: 'assistant', content: prepared.source }, { role: 'user', content: buildRepairMessage(problems) }]
        }
      }

      const fallback = prepareSegment(options.fallback, chapterId)
      const fallbackProblems = await check(fallback, path, chapterId, starting)
      if (fallbackProblems.length)
        throw new Error(`Fallback segment of "${mode.id}" is invalid: ${fallbackProblems.map(problem => problem.message).join('; ')}`)
      return { index, chapterId, path, source: fallback.source, title: fallback.title!, plotSummary: fallback.plotSummary!, attempts, fallback: true, problems, variables: starting }
    },

    async accept(segment, action) {
      if (!compiled)
        throw new Error('Call start() before accept()')
      const project = compiled.result.project
      const chapter = compiled.program.chapters[action.chapterId]
      const block = chapter && chapter.order.map(id => chapter.nodes[id]).findLast(node => node?.kind === 'choices')
      const options = (block?.data?.options ?? []) as unknown as RuntimeChoice[]
      const file = project.chapters.find(item => item.id === action.chapterId)?.sources.at(-1)
      if (!file || !options.some(option => option.id === action.choiceId))
        throw new Error(`No choice "${action.choiceId}" in chapter "${action.chapterId}"`)

      const next = { ...files }
      next[file] = linkChoices(
        files[file],
        options.map(option => option.label),
        options.map(option => option.target ? undefined : option.id === action.choiceId ? `${segment.chapterId}#${segment.chapterId}` : UNWRITTEN_TARGET),
      )
      next[segment.path] = segment.source
      compiled = await build(next)
      Object.assign(files, next)
      const record: SegmentRecord = { ...segment, action }
      segments.push(record)
      return {
        ...compiled,
        segment: record,
        entry: { chapterId: segment.chapterId, nodeId: segment.chapterId },
        variables: segment.variables,
      }
    },
  }
}
