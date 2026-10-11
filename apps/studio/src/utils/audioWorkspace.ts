import type { AudioAssetKind } from '@advjs/audio'
import type { AdvAssetEntry, VoiceAuthoringSnapshot } from '@advjs/types'
import { audioAssetKinds, resolveVoiceSpokenText, resolveVoiceTake } from '@advjs/audio'

export const studioAudioKinds = audioAssetKinds
export type StudioAudioKind = AudioAssetKind

export interface StudioVoiceReviewRow {
  lineId: string
  locale: string
  speakerId: string
  displayText: string
  spokenText: string
  selectedTake: string | null
  takes: Array<VoiceAuthoringSnapshot['ledger']['lines'][string]['locales'][string]['takes'][number] & {
    selected: boolean
    stale: boolean
    unavailable: boolean
  }>
}

/** Review every locale and immutable take; selection remains a separate action. */
export function studioVoiceReviewRows(snapshot: VoiceAuthoringSnapshot): StudioVoiceReviewRow[] {
  return Object.entries(snapshot.ledger.lines).flatMap(([lineId, line]) => Object.entries(line.locales).map(([locale, binding]) => ({
    lineId,
    locale,
    speakerId: line.speakerId,
    displayText: binding.displayText ?? line.displayText,
    spokenText: resolveVoiceSpokenText(binding.displayText ?? line.displayText, { override: binding.spokenText ?? line.spokenText, locale, pronunciation: snapshot.pronunciation }),
    selectedTake: binding.selectedTake,
    takes: binding.takes.map((take) => {
      const checked = {
        ...snapshot.ledger,
        lines: { ...snapshot.ledger.lines, [lineId]: { ...line, locales: { ...line.locales, [locale]: { ...binding, selectedTake: take.id } } } },
      }
      let stale = false
      let unavailable = false
      try {
        stale = resolveVoiceTake(checked, { lineId, locale, assets: snapshot.catalog.assets, spokenText: resolveVoiceSpokenText(binding.displayText ?? line.displayText, { override: binding.spokenText ?? line.spokenText, locale, pronunciation: snapshot.pronunciation }) }).warnings.length > 0
        unavailable = snapshot.catalog.assets.find(asset => asset.id === take.assetId)?.state === 'rejected'
      }
      catch {
        unavailable = true
      }
      return { ...take, selected: take.id === binding.selectedTake, stale, unavailable }
    }),
  })))
}

export function filterStudioAudioAssets(assets: AdvAssetEntry[], kind: string, query: string): AdvAssetEntry[] {
  const needle = query.trim().toLocaleLowerCase()
  return assets.filter(asset => asset.type === 'audio' && (kind === 'all' || asset.kind === kind)
    && (!needle || [asset.id, asset.title, asset.kind, ...(asset.labels ?? [])].some(value => value?.toLocaleLowerCase().includes(needle))))
}

export function isLedgerAudioAsset(snapshot: VoiceAuthoringSnapshot, assetId: string): boolean {
  return Object.values(snapshot.ledger.lines).some(line => Object.values(line.locales).some(binding => binding.takes.some(take => take.assetId === assetId)))
}

/** Local metadata inspection owns its object URL and never starts playback. */
export async function inspectStudioAudioDuration(file: Blob): Promise<number | undefined> {
  const url = URL.createObjectURL(file)
  const audio = document.createElement('audio')
  try {
    return await new Promise((resolve) => {
      const finish = () => resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined)
      const timer = setTimeout(finish, 5000)
      audio.onloadedmetadata = () => {
        clearTimeout(timer)
        finish()
      }
      audio.onerror = () => {
        clearTimeout(timer)
        resolve(undefined)
      }
      audio.preload = 'metadata'
      audio.src = url
      audio.load()
    })
  }
  finally {
    audio.onloadedmetadata = null
    audio.onerror = null
    audio.removeAttribute('src')
    audio.load()
    URL.revokeObjectURL(url)
  }
}
