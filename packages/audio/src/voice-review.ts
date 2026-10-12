import type { CharacterVoiceProfile, RuntimeProgram, VoiceAuthoringSnapshot, VoiceTake } from '@advjs/types'
import { audioFingerprint } from './fingerprint'
import { normalizeAudioLocale } from './locale'
import { prepareVoiceSpokenText } from './spoken-text'
import { resolveVoiceTake } from './voice-ledger'

export interface VoiceReviewContext {
  /** Current dialogue rows obtained from the shared compiled RuntimeProgram. */
  lines?: readonly { lineId: string, speakerId: string, displayText: string }[]
  sourceLocale?: string
  profiles?: Readonly<Record<string, CharacterVoiceProfile | undefined>>
}

export interface VoiceReviewRow {
  lineId: string
  locale: string
  speakerId: string
  displayText: string
  spokenText: string
  selectedTake: string | null
  takes: Array<VoiceTake & { selected: boolean, stale: boolean, unavailable: boolean }>
}

export function voiceReviewContextFromProgram(program: RuntimeProgram | undefined, profiles: VoiceReviewContext['profiles'], sourceLocale = 'zh-CN'): VoiceReviewContext {
  return {
    sourceLocale,
    profiles,
    lines: Object.values(program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).filter(node => ['dialog', 'narration'].includes(node.kind) && typeof node.data?.lineId === 'string').map(node => ({ lineId: String(node.data!.lineId), speakerId: String(node.data?.speakerId ?? 'narrator'), displayText: String(node.data?.text ?? '') })),
  }
}

/** Review history with the same prose, dictionary and profile identity as compilation. */
export async function resolveVoiceReviewRows(snapshot: VoiceAuthoringSnapshot, context: VoiceReviewContext = {}): Promise<VoiceReviewRow[]> {
  const sourceLocale = normalizeAudioLocale(context.sourceLocale ?? 'zh-CN')
  const currentLines = new Map(context.lines?.map(line => [line.lineId, line]))
  const profiles = { ...context.profiles, ...(snapshot.narratorProfile ? { narrator: snapshot.narratorProfile } : {}) }
  const revisions = new Map(await Promise.all(Object.entries(profiles).filter((entry): entry is [string, CharacterVoiceProfile] => Boolean(entry[1])).map(async ([speakerId, profile]) => [speakerId, await audioFingerprint(JSON.parse(JSON.stringify(profile)))] as const)))
  return await Promise.all(Object.entries(snapshot.ledger.lines).flatMap(([lineId, line]) => Object.entries(line.locales).map(async ([locale, binding]) => {
    const current = currentLines.get(lineId)
    const displayText = locale === sourceLocale && current ? current.displayText : binding.displayText ?? line.displayText
    let prepared: Awaited<ReturnType<typeof prepareVoiceSpokenText>> | undefined
    try {
      prepared = await prepareVoiceSpokenText(displayText, { override: binding.spokenText ?? line.spokenText, locale, pronunciation: snapshot.pronunciation })
    }
    catch { /* Historical audio stays reviewable when current prose needs an explicit override. */ }
    const staleSource = !prepared || (context.lines !== undefined && !current) || Boolean(current && current.speakerId !== line.speakerId) || (context.profiles !== undefined && !revisions.has(line.speakerId))
    const takes = binding.takes.map((take) => {
      const checked = { ...snapshot.ledger, lines: { ...snapshot.ledger.lines, [lineId]: { ...line, locales: { ...line.locales, [locale]: { ...binding, selectedTake: take.id } } } } }
      let stale = staleSource
      let unavailable = false
      try {
        const result = resolveVoiceTake(checked, {
          lineId,
          locale,
          assets: snapshot.catalog.assets,
          spokenText: prepared?.text ?? take.spokenText,
          ...(prepared ? { pronunciationRevision: prepared.pronunciationRevision ?? null } : {}),
          ...(revisions.has(line.speakerId) ? { voiceProfileRevision: revisions.get(line.speakerId)! } : {}),
        })
        stale ||= result.warnings.length > 0
        unavailable = snapshot.catalog.assets.find(asset => asset.id === take.assetId)?.state === 'rejected'
      }
      catch { unavailable = true }
      return { ...take, selected: take.id === binding.selectedTake, stale, unavailable }
    })
    return { lineId, locale, speakerId: line.speakerId, displayText, spokenText: prepared?.text ?? '', selectedTake: binding.selectedTake, takes }
  })))
}
