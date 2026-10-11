import { assertAudioId } from './ids'
import { normalizeAudioLocale } from './locale'

function path(value: string) {
  if (!value || value.split('/').some(segment => !/^[a-zA-Z0-9][\w.-]*$/u.test(segment) || ['.', '..', '.git', 'node_modules'].includes(segment.toLowerCase())))
    throw new Error('AUDIO_OBJECT_KEY_INVALID: Use stable ASCII path segments')
  return value
}

export function audioObjectKey(input: {
  projectPrefix: string
  kind: 'bgm' | 'ambience' | 'voice' | 'sfx' | 'ui'
  assetId: string
  sha256: string
  extension: 'webm' | 'm4a' | 'wav' | 'mp3' | 'ogg' | 'flac'
  locale?: string
  speakerId?: string
  lineId?: string
  takeId?: string
}): string {
  const prefix = path(input.projectPrefix)
  if (!/^[a-f0-9]{64}$/u.test(input.sha256) || !['webm', 'm4a', 'wav', 'mp3', 'ogg', 'flac'].includes(input.extension))
    throw new Error('AUDIO_OBJECT_KEY_INVALID: A full SHA-256 and fixed audio extension are required')
  if (input.kind === 'voice') {
    assertAudioId(input.lineId, 'line')
    assertAudioId(input.takeId, 'take')
    const speaker = path(input.speakerId ?? '')
    if (speaker.includes('/') || !input.locale)
      throw new Error('AUDIO_OBJECT_KEY_INVALID: Voice keys require a locale and speaker slug')
    return `${prefix}/audio/voice/${normalizeAudioLocale(input.locale).toLowerCase()}/${speaker}/${input.lineId}/${input.takeId}.${input.sha256}.${input.extension}`
  }
  if (!['bgm', 'ambience', 'sfx', 'ui'].includes(input.kind))
    throw new Error('AUDIO_OBJECT_KEY_INVALID: Reference masters are private authoring inputs')
  return `${prefix}/audio/${input.kind}/${path(input.assetId)}.${input.sha256}.${input.extension}`
}
