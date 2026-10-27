import { createBreezeTtsProvider } from '@advjs/plugin-breeze-tts'

export default {
  authoring: {
    voice: {
      providers: [createBreezeTtsProvider({ baseUrl: 'http://127.0.0.1:9997', modelUid: 'breeze-bf16' })],
      defaultProvider: 'breeze-tts',
      presets: { breeze: 'authoring/voices/breeze.json' },
      defaultPreset: 'breeze',
      library: 'authoring/voices/library.json',
      assetManifest: 'adv/assets.json',
    },
  },
}
