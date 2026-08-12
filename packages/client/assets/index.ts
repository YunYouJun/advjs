export interface AdvAudioAssets {
  popDownUrl: string
  popUpOnUrl: string
  popUpOffUrl: string
}

const cdnPrefix = 'https://assets.advjs.org'

export const audios: AdvAudioAssets = {
  popDownUrl: `${cdnPrefix}/audio/pop-down.mp3`,
  popUpOnUrl: `${cdnPrefix}/audio/pop-up-on.mp3`,
  popUpOffUrl: `${cdnPrefix}/audio/pop-up-off.mp3`,
}

/**
 * Override UI sound resources before the client audio store is created.
 * Empty URLs intentionally disable loading and are useful for offline hosts.
 */
export function configureAudioAssets(overrides: Partial<AdvAudioAssets>) {
  Object.assign(audios, overrides)
}

export const assets = {
  audios,
}
