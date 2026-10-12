import type { AudioGenerationCost, VoiceGenerationResolvedInput, VoiceGenerationRunnerOptions } from '@advjs/audio'
import type { CharacterVoiceProfile, RuntimeProgram, VoiceAuthoringSnapshot } from '@advjs/types'
import type { InjectionKey } from 'vue'
import type { IFileSystem } from './fs'
import { audioFingerprint, canonicalAudioJson, createAudioId, isAudioId, normalizeAudioLocale, voiceGenerationInputFingerprint } from '@advjs/audio'
import { compileProject } from '@advjs/core'

export async function readStudioVoiceJobContext(fs: IFileSystem, snapshot?: VoiceAuthoringSnapshot) {
  const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
  const { project, diagnostics } = await compileProject({ files }, { allowEmptyAssetManifest: true })
  if (project.root !== 'adv')
    throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
  if (!project.program)
    throw new Error(diagnostics.find(diagnostic => diagnostic.severity === 'error')?.code ?? 'AUDIO_JOB_PROGRAM_REQUIRED')
  return studioVoiceJobContext(project.program, { ...Object.fromEntries(project.characters.map(character => [character.id, character.voiceProfile])), narrator: snapshot?.narratorProfile }, typeof project.game.locale === 'string' ? project.game.locale : 'zh-CN')
}

export interface StudioVoiceJobLine {
  chapterId: string
  lineId: string
  speakerId: string
  displayText: string
}

export interface StudioVoiceJobContext {
  lines: StudioVoiceJobLine[]
  chapters: Array<{ id: string, title: string }>
  profiles: Record<string, CharacterVoiceProfile | undefined>
  unidentifiedLines: number
  sourceLocale?: string
}

/** A trusted host supplies real synthesis/query seams, never browser secrets. */
export interface StudioVoiceGenerationTransport {
  /** Read-only inspection of the real preset, model revision and generation inputs. */
  prepare?: (input: VoiceGenerationResolvedInput, snapshot: VoiceAuthoringSnapshot) => Promise<VoiceGenerationResolvedInput>
  execute: NonNullable<VoiceGenerationRunnerOptions['execute']>
  query?: VoiceGenerationRunnerOptions['query']
  verifyInput?: VoiceGenerationRunnerOptions['verifyInput']
  quote?: (input: VoiceGenerationResolvedInput) => Promise<AudioGenerationCost | null>
  providerConcurrency?: Record<string, number>
}

export const studioVoiceGenerationTransportKey: InjectionKey<StudioVoiceGenerationTransport> = Symbol('studio-voice-generation-transport')

export async function prepareStudioVoiceJobInput(input: VoiceGenerationResolvedInput, snapshot: VoiceAuthoringSnapshot, transport?: Pick<StudioVoiceGenerationTransport, 'prepare'>) {
  if (!transport?.prepare)
    return input
  const identity = (value: VoiceGenerationResolvedInput) => Object.fromEntries([
    'lineId',
    'locale',
    'speakerId',
    'displayText',
    'spokenText',
    'providerId',
    'voiceId',
    'model',
    'voiceProfileRevision',
    'source',
    'rights',
  ].filter(key => value[key as keyof VoiceGenerationResolvedInput] !== undefined).map(key => [key, value[key as keyof VoiceGenerationResolvedInput]]))
  const expectedIdentity = canonicalAudioJson(identity(input))
  const inspected = await transport.prepare(JSON.parse(JSON.stringify(input)), snapshot)
  if (canonicalAudioJson(identity(inspected)) !== expectedIdentity)
    throw new Error('AUDIO_JOB_INSPECTION_IDENTITY_CHANGED')
  // The shared encoder rejects credentials and signed URLs, including nested fields.
  const parameters = inspected.parameters === undefined ? undefined : JSON.parse(canonicalAudioJson(inspected.parameters))
  return { ...input, assetPath: inspected.assetPath, ...(parameters ? { parameters } : {}) }
}

export function studioVoiceJobContext(program: RuntimeProgram, profiles: StudioVoiceJobContext['profiles'], sourceLocale = 'zh-CN'): StudioVoiceJobContext {
  const lines: StudioVoiceJobLine[] = []
  let unidentifiedLines = 0
  const chapters = Object.values(program.chapters).map(chapter => ({ id: chapter.id, title: chapter.title ?? chapter.id }))
  for (const chapter of Object.values(program.chapters)) {
    for (const id of chapter.order) {
      const node = chapter.nodes[id]
      if (!node || !['dialog', 'narration'].includes(node.kind))
        continue
      if (!isAudioId(node.data?.lineId, 'line')) {
        unidentifiedLines++
        continue
      }
      if (typeof node.data?.speakerId === 'string' && typeof node.data.text === 'string')
        lines.push({ chapterId: chapter.id, lineId: node.data.lineId, speakerId: node.data.speakerId, displayText: node.data.text })
    }
  }
  return { lines, chapters, profiles, unidentifiedLines, sourceLocale: normalizeAudioLocale(sourceLocale) }
}

export function studioVoiceJobLocales(context: StudioVoiceJobContext, snapshot: VoiceAuthoringSnapshot) {
  return [...new Set([
    ...Object.values(context.profiles).flatMap(profile => Object.keys(profile?.locales ?? {})),
    ...Object.values(snapshot.ledger.lines).flatMap(line => Object.keys(line.locales)),
  ])].sort()
}

export function studioVoiceJobProviders(context: StudioVoiceJobContext, locale: string) {
  return [...new Set(Object.values(context.profiles).flatMap(profile => Object.keys(profile?.locales?.[locale]?.providers ?? {})))].sort()
}

/** Rehydrate prose from this project's current script, locale and explicit profile. */
export async function resolveStudioVoiceJobInput(context: StudioVoiceJobContext, snapshot: VoiceAuthoringSnapshot, target: { lineId: string, locale: string, providerId: string }): Promise<VoiceGenerationResolvedInput> {
  const locale = normalizeAudioLocale(target.locale)
  const line = context.lines.find(line => line.lineId === target.lineId)
  if (!line)
    throw new Error('AUDIO_JOB_LINE_NOT_FOUND')
  const profile = context.profiles[line.speakerId]
  const binding = profile?.locales?.[locale]?.providers[target.providerId]
  if (!profile || !binding?.voiceId || !binding.model)
    throw new Error('AUDIO_JOB_PROFILE_REQUIRED')
  const ledgerLine = snapshot.ledger.lines[line.lineId]
  const localized = ledgerLine?.locales[locale]
  return {
    lineId: line.lineId,
    speakerId: line.speakerId,
    locale,
    displayText: locale === (context.sourceLocale ?? 'zh-CN') ? line.displayText : localized?.displayText ?? line.displayText,
    ...((localized?.spokenText ?? ledgerLine?.spokenText) !== undefined ? { spokenText: localized?.spokenText ?? ledgerLine?.spokenText } : {}),
    providerId: target.providerId,
    voiceId: binding.voiceId,
    model: binding.model,
    source: binding.source,
    ...(binding.rights ? { rights: binding.rights } : {}),
    voiceProfileRevision: await audioFingerprint(profile),
    assetPath: `voice/${createAudioId('audio')}.wav`,
    pronunciation: snapshot.pronunciation,
  }
}

export interface StudioVoiceJobSelection {
  chapterId: string
  speakerId?: string
  lineId?: string
  locale: string
  providerId: string
  mode: 'chapter' | 'missing' | 'stale'
}

export async function reviewStudioVoiceJobLines(context: StudioVoiceJobContext, snapshot: VoiceAuthoringSnapshot, options: StudioVoiceJobSelection & { prepareInput?: (input: VoiceGenerationResolvedInput) => Promise<VoiceGenerationResolvedInput> }) {
  const lines: VoiceGenerationResolvedInput[] = []
  const blocked: Array<{ lineId: string, code: string }> = []
  for (const line of context.lines.filter(line => (!options.chapterId || line.chapterId === options.chapterId) && (!options.speakerId || line.speakerId === options.speakerId) && (!options.lineId || line.lineId === options.lineId))) {
    try {
      const resolved = await resolveStudioVoiceJobInput(context, snapshot, { ...options, lineId: line.lineId })
      const input = await options.prepareInput?.(resolved) ?? resolved
      const binding = snapshot.ledger.lines[line.lineId]?.locales[options.locale]
      const take = binding?.takes.find(take => take.id === binding.selectedTake)
      const fingerprint = await voiceGenerationInputFingerprint(input)
      if (options.mode === 'missing' && take)
        continue
      if (options.mode === 'stale' && (!take || take.inputFingerprint === fingerprint))
        continue
      lines.push(input)
    }
    catch (cause) {
      blocked.push({ lineId: line.lineId, code: cause instanceof Error ? cause.message.split(':')[0]! : 'AUDIO_JOB_PROFILE_REQUIRED' })
    }
  }
  return { lines, blocked }
}
