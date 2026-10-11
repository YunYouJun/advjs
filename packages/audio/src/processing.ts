import type { AudioProcessingReceipt } from '@advjs/types'
import { canonicalAudioJson } from './fingerprint'

export type AudioProcessingKind = 'voice' | 'bgm' | 'ambience' | 'sfx' | 'ui'
/** Local media only: reject playlists and demuxers that open external inputs. */
export const audioInputArguments = ['-protocol_whitelist', 'file', '-format_whitelist', 'aac,aiff,flac,mp3,ogg,wav,mov,matroska,webm'] as const
export const audioProcessingPresets = {
  voice: { id: 'advjs-voice-v1', lufs: -16, peak: -1, channels: 1, trim: true },
  bgm: { id: 'advjs-bgm-v1', lufs: -18, peak: -1, channels: 2, trim: false },
  ambience: { id: 'advjs-ambience-v1', lufs: -24, peak: -2, channels: 2, trim: false },
  sfx: { id: 'advjs-sfx-v1', lufs: -18, peak: -1, channels: 2, trim: false },
  ui: { id: 'advjs-ui-v1', lufs: -20, peak: -1, channels: 2, trim: false },
} as const

/** One fixed command template for local and worker hosts; filenames are argv, never shell. */
export function audioProcessingArguments(kind: AudioProcessingKind, variant: 'opus' | 'aac', inputPath: string, outputPath: string, options: { short?: boolean } = {}): string[] {
  const preset = audioProcessingPresets[kind]
  if (!preset || !['opus', 'aac'].includes(variant))
    throw new Error('AUDIO_PROCESSING_PRESET_INVALID')
  const trimEdge = 'silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB:start_silence=0.03'
  const trim = preset.trim ? `${trimEdge},areverse,${trimEdge},areverse,` : ''
  const normalize = options.short ? `alimiter=limit=${10 ** (preset.peak / 20)}:level=false` : `loudnorm=I=${preset.lufs}:TP=${preset.peak}:LRA=11`
  return ['-nostdin', '-hide_banner', '-v', 'error', ...audioInputArguments, '-i', inputPath, '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-af', `${trim}${normalize}`, '-ar', '48000', '-ac', String(preset.channels), ...(variant === 'opus' ? ['-c:a', 'libopus', '-b:a', '96k', '-f', 'webm'] : ['-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-f', 'ipod']), '-n', outputPath]
}

export function assertAudioProcessingReceipt(receipt: AudioProcessingReceipt) {
  canonicalAudioJson(receipt)
  const preset = Object.values(audioProcessingPresets).find(preset => preset.id === receipt.presetId)
  const unknown = (value: object, keys: string[]) => Object.keys(value).some(key => !keys.includes(key))
  if (receipt.schemaVersion !== 1 || !['preview', 'release'].includes(receipt.purpose) || !/^[a-f0-9]{64}$/u.test(receipt.masterSha256)
    || !/^[a-f0-9]{64}$/u.test(receipt.ffmpegBuildFingerprint) || !preset
    || unknown(receipt, ['schemaVersion', 'purpose', 'presetId', 'masterSha256', 'ffmpegBuildFingerprint', 'toolchain', 'outputs'])
    || receipt.outputs.length !== 2 || new Set(receipt.outputs.map(output => output.variant)).size !== 2) {
    throw new Error('AUDIO_PROCESSING_RECEIPT_INVALID')
  }
  for (const output of receipt.outputs) {
    const { path, variant, metadata } = output
    if (!path || !['opus', 'aac'].includes(variant) || metadata.codec !== variant || !/^[a-f0-9]{64}$/u.test(metadata.sha256)
      || !Number.isSafeInteger(metadata.bytes) || metadata.bytes <= 0 || !Number.isFinite(metadata.duration) || metadata.duration <= 0
      || metadata.sampleRate !== 48000 || metadata.channels !== preset.channels
      || (metadata.integratedLufs !== null && !Number.isFinite(metadata.integratedLufs)) || !Number.isFinite(metadata.truePeakDb) || metadata.truePeakDb > 0
      || unknown(output, ['path', 'variant', 'metadata'])
      || unknown(metadata, ['sha256', 'bytes', 'mimeType', 'codec', 'duration', 'sampleRate', 'channels', 'integratedLufs', 'truePeakDb'])
      || metadata.mimeType !== (variant === 'opus' ? 'audio/webm' : 'audio/mp4')) {
      throw new Error('AUDIO_PROCESSING_RECEIPT_INVALID')
    }
  }
  return receipt
}
