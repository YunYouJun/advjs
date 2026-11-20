import type { AdvAssetEntry } from '@advjs/types'
import type { AudioAssetKind, AudioAssetMetadataPatch } from './resources'
import { createAudioId } from './ids'

const mimeTypes: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  webm: 'audio/webm',
}

/** Coordinates and immutable identity shared by file-picker imports. */
export function prepareAudioAssetImport(
  metadata: AudioAssetMetadataPatch & { kind: AudioAssetKind },
  master: { name: string, sha256: string, bytes: number, mimeType?: string, duration?: number },
) {
  const extension = master.name.slice(master.name.lastIndexOf('.') + 1).toLowerCase()
  if (!master.name.includes('.') || !Object.hasOwn(mimeTypes, extension) || !master.bytes)
    throw new Error('ADV_AUDIO_FILE_INVALID: Choose a non-empty supported audio file')
  const id = createAudioId('audio')
  const filename = `${id}.${extension}`
  const asset: AdvAssetEntry = {
    id,
    type: 'audio',
    kind: metadata.kind,
    title: metadata.title || master.name,
    path: `audio/${filename}`,
    sha256: master.sha256,
    bytes: master.bytes,
    mimeType: master.mimeType || mimeTypes[extension],
    source: { type: 'original' },
    ...(master.duration ? { duration: master.duration } : {}),
    ...(metadata.labels ? { labels: metadata.labels } : {}),
    ...(metadata.loop !== undefined && metadata.loop !== null ? { loop: metadata.loop } : {}),
    ...(metadata.license ? { license: metadata.license } : {}),
    ...(metadata.music ? { music: metadata.music } : {}),
  }
  return { asset, source: { path: `adv/audio/.staging/${filename}`, sha256: master.sha256, bytes: master.bytes } }
}
