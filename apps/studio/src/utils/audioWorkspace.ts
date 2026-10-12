import type { AudioAssetKind, VoiceReviewRow } from '@advjs/audio'
import type { AdvAssetEntry, VoiceAuthoringSnapshot } from '@advjs/types'
import { audioAssetKinds } from '@advjs/audio'

export { resolveVoiceReviewRows as studioVoiceReviewRows } from '@advjs/audio'

export const studioAudioKinds = audioAssetKinds
export type StudioAudioKind = AudioAssetKind

export type StudioVoiceReviewRow = VoiceReviewRow

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
