import type { AdvAssetEntry, AdvAssetVariant, AdvCharacter, AdvGameAudioAsset, AdvGameAudioSource, VoiceLedger, VoiceLedgerLine } from '@advjs/types'
import { parseVoiceLedger } from './voice-ledger'

const PLAYBACK_KINDS = new Set(['bgm', 'ambience', 'sfx', 'ui'])

/** Voice intent, provider bindings and consent coordinates belong to authoring. */
export function projectRuntimeCharacter(character: AdvCharacter): AdvCharacter {
  const { voiceProfile: _voiceProfile, ...runtime } = character
  return runtime
}

function runtimeAudioSource(source: AdvAssetVariant, duration?: number): AdvGameAudioSource {
  return {
    src: source.path ?? source.url ?? source.objectKey ?? '',
    ...(source.sha256 ? { sha256: source.sha256 } : {}),
    ...(source.bytes === undefined ? {} : { bytes: source.bytes }),
    ...(source.mimeType ? { mime: source.mimeType } : {}),
    ...(duration === undefined ? {} : { duration }),
  }
}

/** Transport metadata is projected only after the host filters private audio and take history. */
export function projectRuntimeAudioAsset(asset: AdvAssetEntry): AdvGameAudioAsset {
  const variants: NonNullable<AdvGameAudioAsset['variants']> = {}
  for (const variant of ['opus', 'aac'] as const) {
    if (asset.variants?.[variant])
      variants[variant] = runtimeAudioSource(asset.variants[variant], asset.duration)
  }
  return {
    ...runtimeAudioSource(asset, asset.duration),
    kind: asset.kind as AdvGameAudioAsset['kind'],
    ...(Object.keys(variants).length ? { variants } : {}),
  }
}

/** Every host resolves variants through its existing catalog adapter and media boundary checks. */
export async function resolveRuntimeAudioAsset(asset: AdvAssetEntry, resolve: (variant?: 'opus' | 'aac') => Promise<string>): Promise<AdvGameAudioAsset> {
  const projected = projectRuntimeAudioAsset(asset)
  for (const variant of ['opus', 'aac'] as const) {
    const source = projected.variants?.[variant]
    if (source)
      source.src = await resolve(variant)
  }
  try {
    projected.src = await resolve()
  }
  catch (error) {
    // A public profile can intentionally omit the private master. Its verified
    // processed transport is playable without exposing another author's take.
    const fallback = projected.variants?.opus ?? projected.variants?.aac
    if (!fallback || !(error instanceof Error) || !/^ADV_ASSET_CATALOG_INVALID: asset ".+" has no location for profile "/u.test(error.message))
      throw error
    projected.src = fallback.src
    projected.mime = fallback.mime ?? (projected.variants?.opus ? 'audio/webm' : 'audio/mp4')
  }
  return projected
}

/** Player projection retains selected takes across locales, excluding authoring history. */
export function projectRuntimeVoiceLedger(ledger: VoiceLedger): VoiceLedger {
  const source = parseVoiceLedger(ledger)
  const lines: Record<string, VoiceLedgerLine> = {}
  for (const [lineId, line] of Object.entries(source.lines)) {
    const locales: VoiceLedgerLine['locales'] = {}
    for (const [locale, binding] of Object.entries(line.locales)) {
      if (!binding.selectedTake)
        continue
      const take = binding.takes.find(take => take.id === binding.selectedTake)!
      locales[locale] = { ...binding, takes: [take] }
    }
    if (Object.keys(locales).length)
      lines[lineId] = { ...line, locales }
  }
  return { schemaVersion: 1, lines }
}

/** Read-only selection index; this Set is domain logic, never a serialized project field. */
export function runtimeAudioAssetIds(ledger?: VoiceLedger): ReadonlySet<string> {
  if (!ledger)
    return new Set()
  const projected = projectRuntimeVoiceLedger(ledger)
  return new Set(Object.values(projected.lines).flatMap(line => Object.values(line.locales).map(binding => binding.takes[0]!.assetId)))
}

/** Production audio contains playback kinds and only explicitly selected voice assets. */
export function isRuntimeAudioAsset(asset: Pick<AdvAssetEntry, 'id' | 'type' | 'kind'>, selectedVoiceAssets: ReadonlySet<string>): boolean {
  return asset.type === 'audio' && (PLAYBACK_KINDS.has(asset.kind) || (asset.kind === 'voice' && selectedVoiceAssets.has(asset.id)))
}

/** Build catalog filter preserves non-audio project resources alongside production audio. */
export function isRuntimeProjectAsset(asset: Pick<AdvAssetEntry, 'id' | 'type' | 'kind'>, selectedVoiceAssets: ReadonlySet<string>): boolean {
  return asset.type !== 'audio' || isRuntimeAudioAsset(asset, selectedVoiceAssets)
}
