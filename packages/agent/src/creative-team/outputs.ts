import type { CreativeFileChange, CreativeTeamLimits, CreativeTeamPlan } from './contracts'
import type { CreativeDirectorSummaryEvidence, CreativeDirectorSummaryOutput } from './director-summary'
import type { CreativeNarrativeConcern } from './narrative-concerns'
import type { CreativeVoiceIntent } from './voice-direction'
import { parseCreativeDirectorSummaryOutput } from './director-summary'
import { parseCreativeNarrativeConcern } from './narrative-concerns'
import { parseCreativeTeamPlan } from './validation'
import { assertCreativeDictionaryTerms, creativeVoiceDirectionFileChanges, creativeVoiceLocale, parseCreativeVoiceIntent } from './voice-direction'
import { matchesCreativeVoiceLineSource } from './voice-lines'

/** A structured cast proposal; these ids belong to the game, not to the partner roster. */
export interface CreativeCharacterProfile {
  id: string
  name: string
  description: string
  motivation: string
  speakingStyle: string
  visualConstraints: readonly string[]
  voiceConstraints: readonly string[]
  relationships: readonly { targetId: string, type: string, description: string }[]
}

/** An art request is a production handoff, not proof that an image exists. */
export interface CreativeArtRequest {
  assetId: string
  kind: 'portrait' | 'expression' | 'background'
  characterId?: string
  sceneId?: string
  locationId?: string
  expression?: string
  width: number
  height: number
  prompt: string
  constraints: readonly string[]
  existingAssetId?: string
}

/** Models may propose test inputs; only the runtime/player can produce execution evidence. */
export interface CreativePlaytestScenario {
  id: string
  choices: readonly number[]
  expectedEnding: string
}

/** Full physical source rows, with CRLF normalized to LF; never a reserialization of Markdown. */
export interface CreativeVoiceSourceSpan { line: number, endLine: number, text: string }
/** Stable Markdown targets quote the complete authored block; legacy single rows remain readable. */
export type CreativeVoiceLine = { path: string, speakerId: string, text: string, instruction: string } & ({ line: number, lineId?: never, source?: never } | { lineId: string, line?: never, source?: CreativeVoiceSourceSpan })

export function parseCreativePlaytestScenarios(value: unknown): CreativePlaytestScenario[] {
  const scenarios = array(value, 12, 1).map((item) => {
    const scenario = record(item)
    return { id: id(scenario.id), choices: array(scenario.choices, 32).map(value => integer(value, 0, 31)), expectedEnding: address(scenario.expectedEnding) }
  })
  unique(scenarios.map(scenario => scenario.id))
  return scenarios
}

export type CreativePartnerOutput
  = | CreativeDirectorSummaryOutput
    | { kind: 'production-plan', summary: string, plan: CreativeTeamPlan }
    | { kind: 'characters', summary: string, characters: readonly CreativeCharacterProfile[] }
    | { kind: 'chapter', summary: string, chapters: readonly { id: string, title: string, content: string }[], entryChapterId: string, endingAddresses: readonly string[] }
    | { kind: 'art-direction', summary: string, style: string, requests: readonly CreativeArtRequest[] }
    | { kind: 'voice-direction', summary: string, locale?: string, cast: readonly { speakerId: string, designBrief: string, performance: string, intent?: CreativeVoiceIntent }[], dictionary: readonly { term: string, pronunciation: string }[], lines: readonly CreativeVoiceLine[] }
    | { kind: 'playtest-plan', summary: string, scenarios: readonly CreativePlaytestScenario[], concerns: readonly CreativeNarrativeConcern[] }

/** Effective context assembled by Runtime from saved facts and explicitly selected candidates. */
export interface CreativeOutputContext {
  projectId: string
  projectRevision: string
  files: Readonly<Record<string, string>>
  characterIds: readonly string[]
  limits: CreativeTeamLimits
  directorSummary?: CreativeDirectorSummaryEvidence
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Creative output must be an object')
  return value as Record<string, unknown>
}
function text(value: unknown, maximum = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new TypeError('Invalid creative output text')
  return value
}
function id(value: unknown): string {
  const valueId = text(value, 64)
  if (!/^[a-z][\w-]*$/i.test(valueId))
    throw new TypeError('Invalid game content id')
  return valueId
}
function chapterId(value: unknown): string {
  const valueId = text(value, 64)
  // Existing Studio templates use numbered chapter files such as 01.adv.md.
  if (!/^[a-z0-9][\w-]*$/i.test(valueId))
    throw new TypeError('Invalid chapter id')
  return valueId
}
function array(value: unknown, maximum: number, minimum = 0): unknown[] {
  if (!Array.isArray(value) || value.length > maximum || value.length < minimum)
    throw new TypeError('Invalid creative output collection')
  return value
}
function texts(value: unknown, maximum = 32): string[] {
  return array(value, maximum).map(item => text(item))
}
function integer(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum)
    throw new TypeError('Invalid creative output number')
  return Number(value)
}
function assetId(value: unknown): string {
  const result = text(value, 160)
  if (!/^[\w-]+(?:\/[\w-]+)+$/.test(result))
    throw new TypeError('Invalid stable asset id')
  return result
}
function address(value: unknown): string {
  const result = text(value, 140)
  if (!/^(?!_)\w[\w.-]*#(?!_)\w[\w.-]*$/u.test(result))
    throw new TypeError('Invalid ending address')
  return result
}
function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length)
    throw new TypeError('Duplicate creative output identity')
}

/** Parse only each role's public data schema. The model never chooses paths or media receipts. */
export function parseCreativePartnerOutput(kind: CreativePartnerOutput['kind'], value: unknown, context: CreativeOutputContext): CreativePartnerOutput {
  return parseOutput(kind, value, context, true)
}

/**
 * Decode a persisted candidate's schema; its upstream source may no longer be current.
 * This never grants adoption authority: review revalidates the real project and provenance.
 */
export function parseCreativePartnerOutputSnapshot(value: unknown, context: CreativeOutputContext): CreativePartnerOutput {
  const kind = record(value).kind
  if (!['production-plan', 'characters', 'chapter', 'art-direction', 'voice-direction', 'playtest-plan', 'delivery-summary'].includes(String(kind)))
    throw new TypeError('Unknown creative output kind')
  return parseOutput(kind as CreativePartnerOutput['kind'], value, context, false)
}

function parseOutput(kind: CreativePartnerOutput['kind'], value: unknown, context: CreativeOutputContext, checkReferences: boolean): CreativePartnerOutput {
  const root = record(value)
  if (root.kind !== kind)
    throw new TypeError('Creative output kind mismatch')
  const summary = text(root.summary, 1000)
  if (kind === 'delivery-summary') {
    if (checkReferences && !context.directorSummary)
      throw new TypeError('Director summary requires frozen Runtime evidence')
    return parseCreativeDirectorSummaryOutput(value, checkReferences ? context.directorSummary : undefined)
  }
  if (kind === 'production-plan') {
    const plan = parseCreativeTeamPlan(root.plan, context)
    for (const key of ['maxTasks', 'maxToolCalls', 'maxReworkRounds', 'maxMicroPoints'] as const) {
      if (plan.limits[key] > context.limits[key])
        throw new TypeError('Director plan exceeds author-approved limits')
    }
    return { kind, summary, plan }
  }
  if (kind === 'characters') {
    const characters = array(root.characters, 16, 1).map((item): CreativeCharacterProfile => {
      const character = record(item)
      return {
        id: id(character.id),
        name: text(character.name, 80),
        description: text(character.description),
        motivation: text(character.motivation),
        speakingStyle: text(character.speakingStyle),
        visualConstraints: texts(character.visualConstraints),
        voiceConstraints: texts(character.voiceConstraints),
        relationships: array(character.relationships, 16).map((item) => {
          const relationship = record(item)
          return { targetId: id(relationship.targetId), type: text(relationship.type, 80), description: text(relationship.description) }
        }),
      }
    })
    unique(characters.map(character => character.id))
    const known = new Set([...context.characterIds, ...characters.map(character => character.id)])
    if (checkReferences && characters.some(character => character.relationships.some(relation => !known.has(relation.targetId))))
      throw new TypeError('Character relationship references an unknown id')
    return { kind, summary, characters }
  }
  if (kind === 'chapter') {
    const chapters = array(root.chapters, 12, 1).map((item) => {
      const chapter = record(item)
      return { id: chapterId(chapter.id), title: text(chapter.title, 160), content: text(chapter.content, 32000) }
    })
    unique(chapters.map(chapter => chapter.id))
    const entryChapterId = chapterId(root.entryChapterId)
    if (checkReferences && !chapters.some(chapter => chapter.id === entryChapterId) && !(`adv/chapters/${entryChapterId}.adv.md` in context.files))
      throw new TypeError('Unknown entry chapter')
    const endingAddresses = array(root.endingAddresses, 16, 1).map(address)
    unique(endingAddresses)
    return { kind, summary, chapters, entryChapterId, endingAddresses }
  }
  if (kind === 'art-direction') {
    const requests = array(root.requests, 64, 1).map((item): CreativeArtRequest => {
      const request = record(item)
      if (!['portrait', 'expression', 'background'].includes(String(request.kind)))
        throw new TypeError('Unknown art request kind')
      const characterId = request.characterId === undefined ? undefined : id(request.characterId)
      if (checkReferences && characterId && !context.characterIds.includes(characterId))
        throw new TypeError('Unknown art character id')
      if (request.kind !== 'background' && (!characterId || (checkReferences && !context.characterIds.includes(characterId))))
        throw new TypeError('Character art requires an existing stable character id')
      if (request.kind === 'background' && request.sceneId === undefined)
        throw new TypeError('Background requests require a narrative scene id')
      if (request.kind === 'expression' && request.expression === undefined)
        throw new TypeError('Expression requests require a stable expression id')
      return {
        assetId: assetId(request.assetId),
        kind: request.kind as CreativeArtRequest['kind'],
        ...(characterId ? { characterId } : {}),
        ...(request.sceneId === undefined ? {} : { sceneId: id(request.sceneId) }),
        ...(request.locationId === undefined ? {} : { locationId: id(request.locationId) }),
        ...(request.expression === undefined ? {} : { expression: id(request.expression) }),
        ...(request.existingAssetId === undefined ? {} : { existingAssetId: assetId(request.existingAssetId) }),
        width: integer(request.width, 1, 16384),
        height: integer(request.height, 1, 16384),
        prompt: text(request.prompt),
        constraints: texts(request.constraints),
      }
    })
    unique(requests.map(request => request.assetId))
    return { kind, summary, style: text(root.style), requests }
  }
  if (kind === 'voice-direction') {
    const speaker = (value: unknown): string => {
      const speakerId = id(value)
      if (checkReferences && speakerId !== 'narrator' && !context.characterIds.includes(speakerId))
        throw new TypeError('Unknown voice speaker')
      return speakerId
    }
    const cast = array(root.cast, 32, 1).map((item) => {
      const casting = record(item)
      return { speakerId: speaker(casting.speakerId), designBrief: text(casting.designBrief), performance: text(casting.performance), ...(casting.intent === undefined ? {} : { intent: parseCreativeVoiceIntent(casting.intent) }) }
    })
    unique(cast.map(item => item.speakerId))
    if (!cast.some(item => item.speakerId === 'narrator'))
      throw new TypeError('Narrator casting must be independent')
    const dictionary = array(root.dictionary, 64).map((item) => {
      const term = record(item)
      return { term: text(term.term, 120), pronunciation: text(term.pronunciation, 240) }
    })
    assertCreativeDictionaryTerms(dictionary)
    const lines = array(root.lines, 128).map((item): CreativeVoiceLine => {
      const line = record(item)
      const path = text(line.path, 200)
      if (!/^adv\/chapters\/[\w-]+\.(?:adv\.md|chapter\.json)$/.test(path))
        throw new TypeError('Voice instructions must target chapter dialogue sources')
      const content = text(line.text, 2000)
      let selector: { line: number } | { lineId: string, source?: CreativeVoiceSourceSpan }
      if (line.lineId === undefined) {
        if (line.source !== undefined)
          throw new TypeError('Quoted Markdown voice sources require a stable line ID')
        selector = { line: integer(line.line, 1, 100000) }
      }
      else {
        if (line.line !== undefined || typeof line.lineId !== 'string' || !/^line_[a-f0-9-]{36}$/.test(line.lineId))
          throw new TypeError('Invalid stable voice line selector')
        selector = { lineId: line.lineId }
        if (path.endsWith('.adv.md')) {
          const span = record(line.source)
          if (Object.keys(span).some(key => !['line', 'endLine', 'text'].includes(key)))
            throw new TypeError('Invalid quoted Markdown voice source')
          const start = integer(span.line, 1, 100000)
          const end = integer(span.endLine, start, 100000)
          selector.source = { line: start, endLine: end, text: text(span.text, 48000).replace(/\r\n/g, '\n') }
        }
        else if (line.source !== undefined) {
          throw new TypeError('Flow voice targets do not use Markdown source spans')
        }
      }
      const result: CreativeVoiceLine = { path, ...selector, speakerId: speaker(line.speakerId), text: content, instruction: text(line.instruction) }
      if (checkReferences && !matchesCreativeVoiceLineSource(result, context.files))
        throw new TypeError('Voice instruction does not match the frozen dialogue source')
      return result
    })
    unique(lines.filter(line => line.lineId !== undefined).map(line => line.lineId!))
    return { kind, summary, cast, dictionary, lines, ...(root.locale === undefined ? {} : { locale: creativeVoiceLocale(root.locale) }) }
  }
  const scenarios = parseCreativePlaytestScenarios(root.scenarios)
  const concerns = array(root.concerns, 32).map(item => parseCreativeNarrativeConcern(item, checkReferences ? context.files : undefined))
  return { kind, summary, scenarios, concerns }
}

/** Build finite portable source proposals; media remains in the existing authoring workflows. */
function preservedCharacterFrontmatter(content: string | undefined): string[] {
  const header = content && /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1]
  if (!header)
    return []
  const owned = new Set(['id', 'name', 'relationships'])
  if (header.trimStart().startsWith('{')) {
    const data = record(JSON.parse(header))
    return Object.entries(data).filter(([key]) => !owned.has(key)).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
  }
  const kept: string[] = []
  let skip = false
  for (const line of header.split(/\r?\n/)) {
    if (/^\S/.test(line) && !line.startsWith('#')) {
      const key = /^(?:['"](id|name|relationships)['"]|(id|name|relationships))\s*:/.exec(line)
      skip = Boolean(key)
    }
    if (!skip)
      kept.push(line)
  }
  return kept
}

/** Preserve opaque media/profile metadata when a structured cast candidate edits narrative fields. */
export function creativeOutputFileChanges(output: CreativePartnerOutput, files: Readonly<Record<string, string>>): CreativeFileChange[] {
  const change = (path: string, after: string): CreativeFileChange => ({ path, before: files[path] ?? null, after })
  if (output.kind === 'voice-direction')
    return creativeVoiceDirectionFileChanges(output, files)
  if (output.kind === 'characters') {
    return output.characters.map(character => change(`adv/characters/${character.id}.character.md`, [
      '---',
      `id: ${character.id}`,
      `name: ${JSON.stringify(character.name)}`,
      `relationships: ${JSON.stringify(character.relationships)}`,
      ...preservedCharacterFrontmatter(files[`adv/characters/${character.id}.character.md`]),
      '---',
      '',
      `# ${character.name}`,
      '',
      '## 背景',
      '',
      character.description,
      '',
      '## 理念',
      '',
      character.motivation,
      '',
      '## 说话风格',
      '',
      character.speakingStyle,
      '',
      '### 音色约束',
      '',
      ...character.voiceConstraints.map(item => `- ${item}`),
      '',
      '## 外貌',
      '',
      ...character.visualConstraints.map(item => `- ${item}`),
      '',
    ].join('\n')))
  }
  if (output.kind !== 'chapter')
    return []
  const gamePath = 'adv/settings/game.json'
  const game = files[gamePath] ? record(JSON.parse(files[gamePath])) : {}
  const chapters = Array.isArray(game.chapters) ? [...game.chapters] : undefined
  if (chapters) {
    for (const chapter of output.chapters) {
      const index = chapters.findIndex(item => record(item).id === chapter.id)
      const entry = { ...(index < 0 ? {} : record(chapters[index])), id: chapter.id, title: chapter.title, sources: [`chapters/${chapter.id}.adv.md`] }
      if (index < 0)
        chapters.push(entry)
      else
        chapters[index] = entry
    }
  }
  return [
    ...output.chapters.map(chapter => change(`adv/chapters/${chapter.id}.adv.md`, `${chapter.content.trim()}\n`)),
    change(gamePath, `${JSON.stringify({ ...game, entryChapterId: output.entryChapterId, ...(chapters ? { chapters } : {}) }, null, 2)}\n`),
  ]
}
