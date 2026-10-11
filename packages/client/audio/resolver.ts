import type { AudioResolvedAsset } from '@advjs/audio'
import type { AdvGameAudioAsset, AdvGameAudioSource, AudioBus } from '@advjs/types'

export interface BrowserAudioCapabilities {
  webKit: boolean
  canPlayType?: (mime: string) => boolean
}

export function isWebKitAudioRoutingAffected(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  // iOS Chromium/Firefox are WebKit too; desktop Chromium advertises Chrome/.
  return /AppleWebKit\//u.test(userAgent) && !/(?:Chrome|Chromium|Edg|OPR)\//u.test(userAgent)
}

export function isOpusAudioSource(source: { mime?: string, src?: string, url?: string }): boolean {
  return /audio\/webm|audio\/opus|codecs\s*=\s*["']?opus/iu.test(source.mime ?? '') || /\.(?:webm|opus)(?:[?#]|$)/iu.test(source.src ?? source.url ?? '')
}

export function getBrowserAudioCapabilities(): BrowserAudioCapabilities {
  const media = typeof document === 'undefined' ? undefined : document.createElement('audio')
  return {
    webKit: isWebKitAudioRoutingAffected(),
    canPlayType: media ? mime => media.canPlayType(mime) !== '' : undefined,
  }
}

/** Short, metadata-bounded cues can safely use the existing decoded-memory budget. */
export function canDecodeStreamFallback(source: { duration?: number }): boolean {
  return typeof source.duration === 'number' && Number.isFinite(source.duration) && source.duration > 0 && source.duration < 20
}

function playbackMime(source: AdvGameAudioSource, variant?: 'opus' | 'aac') {
  if (variant === 'opus')
    return 'audio/webm; codecs="opus"'
  if (variant === 'aac')
    return 'audio/mp4; codecs="mp4a.40.2"'
  return source.mime
}

/** The real player, Editor and Studio director all use this transport decision. */
export function resolveBrowserAudioAsset(assetId: string, asset: AdvGameAudioAsset, bus: Exclude<AudioBus, 'master'>, capabilities = getBrowserAudioCapabilities()): AudioResolvedAsset {
  const streamed = bus === 'music' || bus === 'ambience' || (bus === 'voice' && !canDecodeStreamFallback(asset))
  const order = streamed && capabilities.webKit ? ['aac', 'master', 'opus'] as const : ['opus', 'aac', 'master'] as const
  const candidates = order.flatMap((name) => {
    const source = name === 'master' ? asset : asset.variants?.[name]
    return source?.src ? [{ source, name }] : []
  })
  // WebKit reports canPlayType(Opus)='probably', but MediaElementAudioSource
  // bypasses the GainNode graph. AAC is required for mixer-safe long playback:
  // https://bugs.webkit.org/show_bug.cgi?id=276813 (confirmed through Safari 26.6).
  for (const { source, name } of candidates) {
    if (streamed && capabilities.webKit && (name === 'opus' || isOpusAudioSource(source)))
      continue
    const mime = playbackMime(source, name === 'master' ? undefined : name)
    if (name !== 'master' && mime && capabilities.canPlayType && !capabilities.canPlayType(mime))
      continue
    return { assetId, url: source.src, mime: source.mime ?? mime, duration: source.duration ?? asset.duration }
  }
  const fallback = candidates.find(({ source, name }) => (name === 'opus' || isOpusAudioSource(source)) && canDecodeStreamFallback({ duration: source.duration ?? asset.duration }))
  if (streamed && capabilities.webKit && fallback)
    return { assetId, url: fallback.source.src, mime: fallback.source.mime ?? 'audio/webm; codecs="opus"', duration: fallback.source.duration ?? asset.duration }
  throw new Error('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED: Compatible processed AAC audio is required for this stream')
}
