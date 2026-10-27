import type { AdvConfig, AdvVoiceSynthesisRequest } from '@advjs/types'
import type { BreezeTtsProviderOptions } from '../../../plugins/plugin-breeze-tts/src'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createBreezeTtsProvider } from '../../../plugins/plugin-breeze-tts/src'
import { createEditorVoiceJobsFixture } from './editor-voice-jobs'

/** A minimal native project; uses one shared, already-loaded local model. */
export async function createEditorBreezeFixture(options: BreezeTtsProviderOptions = {}) {
  const fixture = await createEditorVoiceJobsFixture()
  const provider = createBreezeTtsProvider(options)
  const requests: Array<{ input: AdvVoiceSynthesisRequest, candidate: { path: string, sha256: string, bytes: number } }> = []
  const synthesize = provider.synthesize.bind(provider)
  provider.synthesize = async (input) => {
    const result = await synthesize(input)
    requests.push({ input, candidate: result.candidates[0]! })
    return result
  }
  const gamePath = join(fixture.root, 'adv/settings/game.json')
  const game = JSON.parse(await readFile(gamePath, 'utf8'))
  game.title = 'Breeze 本地配音'
  delete game.characters[0].voiceProfile
  await writeFile(gamePath, JSON.stringify(game))
  await writeFile(join(fixture.root, 'adv/audio/voice-profiles.json'), JSON.stringify({ schemaVersion: 1, revision: 1 }))
  await writeFile(join(fixture.root, 'preset.json'), JSON.stringify({ schemaVersion: 1, model: 'Breeze-TTS-2', seed: 42, cfgScale: 4, characters: [{ id: 'hero', text: '你好，世界。', description: '年轻自然的女声，开心地说话。' }] }))
  const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider], defaultProvider: provider.id, defaultPreset: 'breeze', presets: { breeze: 'preset.json' } } } }
  return { ...fixture, config, provider, requests }
}
