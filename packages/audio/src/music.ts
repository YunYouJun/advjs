import type { AdvAssetEntry, AdvMusicMetadata, AdvMusicUsage } from '@advjs/types'
import { musicUsages, parseAdvMusicMetadata } from '@advjs/assets'

export { musicUsages, parseAdvMusicMetadata as parseMusicMetadata }

/** A brief is an explicit handoff to the author's chosen tool, never a generation request. */
export function createMusicMetadata(input: Omit<AdvMusicMetadata, 'schemaVersion' | 'review'>): AdvMusicMetadata {
  return parseAdvMusicMetadata({ ...input, schemaVersion: 1, review: { status: 'pending' } })
}

export interface MusicReviewState {
  status: 'legacy' | 'pending' | 'approved' | 'rejected' | 'invalid'
  canBind: boolean
  reasons: string[]
}

/** Legacy BGM remains compatible; new music records require explicit hash-bound review. */
export function inspectMusicReview(asset: Pick<AdvAssetEntry, 'type' | 'kind' | 'sha256' | 'license' | 'state' | 'music'>): MusicReviewState {
  const reasons: string[] = []
  if (asset.type !== 'audio' || asset.kind !== 'bgm')
    reasons.push('MUSIC_ASSET_KIND_INVALID')
  if (asset.state === 'rejected')
    reasons.push('MUSIC_REJECTED')
  if (!asset.music)
    return { status: 'legacy', canBind: reasons.length === 0, reasons }
  let music: AdvMusicMetadata
  try {
    music = parseAdvMusicMetadata(asset.music)
  }
  catch {
    return { status: 'invalid', canBind: false, reasons: [...reasons, 'MUSIC_METADATA_INVALID'] }
  }
  if (music.review.status !== 'approved')
    reasons.push(music.review.status === 'rejected' ? 'MUSIC_REJECTED' : 'MUSIC_REVIEW_REQUIRED')
  if (music.review.status === 'approved' && music.review.sha256 !== asset.sha256)
    reasons.push('MUSIC_AUDIO_CHANGED')
  if (music.rights && asset.license && music.rights.license !== asset.license)
    reasons.push('MUSIC_LICENSE_MISMATCH')
  return { status: music.review.status, canBind: reasons.length === 0, reasons }
}

/** Suggestions are editable canonical BGM parameters, never claims about the imported audio. */
export function musicPlaybackDefaults(usage: AdvMusicUsage) {
  if (!musicUsages.includes(usage))
    throw new Error('MUSIC_METADATA_INVALID: Unknown musical usage')
  return { gain: 0.7, loop: usage === 'background', fade: { in: 500, out: 1000 } }
}

export function exportMusicBrief(input: AdvMusicMetadata): string {
  const music = parseAdvMusicMetadata(input)
  const brief = music.brief
  const lines = ['ADV.JS music brief', `Usage: ${music.usage}`, `Source: ${music.source.type}`]
  if (music.source.tool)
    lines.push(`Tool: ${music.source.tool}`)
  if (music.source.url)
    lines.push(`Source page (not playback URL): ${music.source.url}`)
  if (brief) {
    lines.push(`Brief: ${brief.summary}`)
    for (const field of ['mood', 'style', 'durationSeconds', 'tempoBpm', 'instrumental', 'loopIntent', 'notes'] as const) {
      if (brief[field] !== undefined)
        lines.push(`${field}: ${brief[field]}`)
    }
  }
  lines.push('Generate or compose in your chosen tool, then export an audio file. Import, audition, review the license and bind explicitly in ADV.JS. Creation targets do not guarantee measured duration or seamless looping.')
  return `${lines.join('\n')}\n`
}
