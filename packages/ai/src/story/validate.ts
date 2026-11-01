import type { AdvProjectDiagnostic, JsonObject, JsonValue, RuntimeActionCall, RuntimeChapter, RuntimeChoice, RuntimeNode } from '@advjs/types'
import type { PreparedSegment } from './source'
import type { StoryActionType, StoryLimits, StoryModeSpec, StoryProblem } from './types'
import { choiceLines, textLength } from './source'

/** Node kinds a generated segment may compile to. Plain paragraphs (`text`) are not among them. */
const ALLOWED_KINDS = new Set(['anchor', 'scene', 'narration', 'dialog', 'actions', 'choices', 'end'])

export interface ValidateSegmentInput {
  prepared: PreparedSegment
  /** The segment's compiled chapter; missing when the compiler produced none. */
  chapter?: RuntimeChapter
  /** Error diagnostics the compiler reported for the segment's file. */
  errors: readonly AdvProjectDiagnostic[]
  mode: StoryModeSpec
  limits: StoryLimits
  /** Variables the segment starts with, to type-check `variables/set`. */
  variables: JsonObject
}

/** The compiler keeps each node's source position on the node. */
function lineOf(node: RuntimeNode): number | undefined {
  return (node as RuntimeNode & { source?: { line?: number } }).source?.line
}

function kindHint(kind: string): string {
  if (kind === 'text')
    return 'Plain paragraphs are not allowed; start narration with "> ".'
  return `"${kind}" is not allowed; use only narration, dialogue, a \`type: actions\` block and the closing choices.`
}

function sameType(a: JsonValue | undefined, b: JsonValue): boolean {
  if (a === undefined || a === null)
    return true
  if (Array.isArray(a))
    return Array.isArray(b)
  return typeof a === typeof b && !Array.isArray(b)
}

function checkActions(
  actions: readonly RuntimeActionCall[],
  { mode, limits, variables }: ValidateSegmentInput,
  line: number | undefined,
  problems: StoryProblem[],
) {
  for (const action of actions) {
    const args = action.args ?? {}
    const key = typeof args.key === 'string' ? args.key : undefined
    const rule = key ? mode.variables[key] : undefined
    if (!key || !rule) {
      problems.push({ code: 'segment/action-key', message: `Variable "${key ?? '?'}" cannot be changed. Allowed: ${Object.keys(mode.variables).filter(k => mode.variables[k].actions.length).join(', ')}.`, line })
      continue
    }
    if (!rule.actions.includes(action.type as StoryActionType)) {
      problems.push({ code: 'segment/action-type', message: `"${action.type}" is not allowed on "${key}". Allowed: ${rule.actions.join(', ') || 'none'}.`, line })
      continue
    }
    if (action.type === 'variables/increment' || action.type === 'variables/decrement') {
      const by = args.by ?? 1
      const max = rule.maxStep ?? 1
      if (typeof by !== 'number' || !Number.isInteger(by) || by < 1 || by > max)
        problems.push({ code: 'segment/action-step', message: `"by" on "${key}" must be a whole number from 1 to ${max}.`, line })
    }
    if (action.type === 'variables/set' && (args.value === undefined || !sameType(variables[key], args.value)))
      problems.push({ code: 'segment/action-value', message: `"${key}" must keep its type.`, line })
    if (action.type === 'variables/push-unique' || action.type === 'variables/remove' || (action.type === 'variables/set' && typeof args.value === 'string')) {
      const max = limits.values[key]
      if (typeof args.value !== 'string' || !args.value.trim())
        problems.push({ code: 'segment/action-value', message: `"${key}" takes a short text value.`, line })
      else if (max !== undefined && textLength(args.value) > max)
        problems.push({ code: 'segment/action-value', message: `Values of "${key}" are at most ${max} characters.`, line })
    }
  }
}

/**
 * Checks a segment the way the host needs it: it compiled, it holds only the allowed blocks,
 * it ends in one choice block of the right size with no targets, and it only touches the
 * variables the mode allows, within bounds. Problems carry a line so the model can fix them.
 */
export function validateSegment(input: ValidateSegmentInput): StoryProblem[] {
  const { prepared, chapter, errors, mode, limits } = input
  const problems: StoryProblem[] = errors.map(error => ({ code: error.code, message: error.message, line: error.line }))
  if (problems.length)
    return problems
  if (!chapter)
    return [{ code: 'segment/empty', message: 'The file produced no story.' }]

  if (!prepared.plotSummary)
    problems.push({ code: 'segment/summary', message: 'Start the file with frontmatter that sets plotSummary.' })
  else if (textLength(prepared.plotSummary) > limits.plotSummary)
    problems.push({ code: 'segment/summary-length', message: `plotSummary is at most ${limits.plotSummary} characters.` })
  if (!prepared.title)
    problems.push({ code: 'segment/title', message: 'Put a "## " title right after the frontmatter.' })
  else if (textLength(prepared.title) > limits.title)
    problems.push({ code: 'segment/title-length', message: `The title is at most ${limits.title} characters.` })
  if (prepared.title && prepared.titleNotFirst)
    problems.push({ code: 'segment/title-position', message: 'Nothing may come between the frontmatter and the "## " title.' })

  const nodes = chapter.order.map(id => chapter.nodes[id]).filter(Boolean)
  let text = 0
  let count = 0
  const choiceNodes: RuntimeNode[] = []
  for (const node of nodes) {
    if (!ALLOWED_KINDS.has(node.kind)) {
      problems.push({ code: 'segment/node-kind', message: kindHint(node.kind), line: lineOf(node) })
      continue
    }
    if (node.kind !== 'anchor' && node.kind !== 'end')
      count++
    if (node.when)
      problems.push({ code: 'segment/when', message: 'Conditions (`when`) are not allowed.', line: lineOf(node) })
    if ((node.kind === 'narration' || node.kind === 'dialog') && typeof node.data?.text === 'string')
      text += textLength(node.data.text)
    if (node.kind === 'actions')
      checkActions(node.actions ?? [], input, lineOf(node), problems)
    if (node.kind === 'choices')
      choiceNodes.push(node)
  }
  if (count > mode.maxNodes)
    problems.push({ code: 'segment/length', message: `Keep the segment to at most ${mode.maxNodes} blocks.` })
  if (text > limits.text)
    problems.push({ code: 'segment/text-length', message: `Narration and dialogue together are at most ${limits.text} characters; this has ${text}.` })

  const { min, max, optional } = mode.choices
  if (choiceNodes.length > 1) {
    problems.push({ code: 'segment/choices-many', message: 'Write only one choice block, at the very end.', line: lineOf(choiceNodes[1]) })
  }
  else if (!choiceNodes.length) {
    if (!optional)
      problems.push({ code: 'segment/choices-missing', message: `End with ${min}–${max} choices, each on its own "- " line.` })
  }
  else {
    const node = choiceNodes[0]
    const line = lineOf(node)
    const after = nodes.slice(nodes.indexOf(node) + 1)
    if (after.some(next => next.kind !== 'end'))
      problems.push({ code: 'segment/choices-position', message: 'The choices must be the last thing in the file.', line })
    const options = (node.data?.options ?? []) as unknown as RuntimeChoice[]
    if (options.length < min || options.length > max)
      problems.push({ code: 'segment/choices-count', message: `Offer ${min === max ? min : `${min}–${max}`} choices; this has ${options.length}.`, line })
    if (options.some(option => option.target))
      problems.push({ code: 'segment/choice-target', message: 'Choices must not link anywhere; write "- text" only.', line })
    if (options.some(option => option.when))
      problems.push({ code: 'segment/choice-when', message: 'Choices must not have conditions (`when`).', line })
    for (const option of options)
      checkActions(option.actions ?? [], input, line, problems)
    if (choiceLines(prepared.source).length !== options.length)
      problems.push({ code: 'segment/choices-format', message: 'Write each choice as one unindented "- " line.', line })
  }
  return problems
}
