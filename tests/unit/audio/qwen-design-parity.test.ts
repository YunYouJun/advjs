// @vitest-environment node
import type { AdvConfig, VoiceDesignDraft } from '@advjs/types'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { addVoiceDesignVersion, VOICE_DESIGN_LIBRARY_PATH, voiceInputFingerprint } from '@advjs/audio'
import { describe, expect, it, vi } from 'vitest'
import { createNodeVoiceDesignHost } from '../../../packages/advjs/node/audio/voice-design'
import { createVoiceDesignMirrorValidator } from '../../../packages/advjs/node/audio/voice-design-sync'
import { canonicalVoiceGenerationParameters } from '../../../packages/advjs/node/audio/voice-provenance'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { runVoicePreview } from '../../../packages/advjs/node/commands/voice'
import { loadProject } from '../../../packages/advjs/node/project'
import { createQwenTtsProvider } from '../../../plugins/plugin-qwen-tts/src'
import { createVoiceDesignFixture } from '../../fixtures/audio/voice-design'

const template = { version: 'trusted-v1', model: 'mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16', revision: 'a'.repeat(40), weightSha256: { 'model.safetensors': 'b'.repeat(64) }, language: 'Chinese', characters: [] }
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

async function fixture() {
  const source = await createVoiceDesignFixture()
  const provider = createQwenTtsProvider()
  const synthesize = vi.spyOn(provider, 'synthesize')
  await writeFile(join(source.root, 'preset.json'), encode(template))
  const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider], defaultProvider: provider.id, defaultPreset: 'approved', presets: { approved: 'preset.json' } } } }
  const host = await createNodeVoiceDesignHost({ root: source.root, config, stateDirectory: join(source.storeDirectory, 'qwen-design') })
  const mirror = createVoiceDesignMirrorValidator({ root: source.root, config })
  const draft: VoiceDesignDraft = { id: 'qwen-designed-v1', version: '1', characterId: 'hero', label: 'Qwen designed', intent: { pitch: 'low', pace: 'slow' }, locales: Object.fromEntries(['zh-CN', 'en-US', 'ja-JP'].map(locale => [locale, { providers: { [provider.id]: { preset: 'approved', source: 'designed', description: '  Calm original direction.  ' } } }])) }
  return { ...source, provider, synthesize, config, host, mirror, draft, async close() {
    await host.close()
    expect(synthesize).not.toHaveBeenCalled()
    expect(source.calls).toHaveLength(0)
    await rm(source.directory, { recursive: true, force: true })
  } }
}

describe('qwen design shared Node and browser mirror protocol', () => {
  it('derives identical native presets for every locale and rejects mismatched locale or intent before sync', async () => {
    const source = await fixture()
    try {
      const saved = await source.host.saveVersion({ expectedRevision: (await source.host.read()).revision, draft: source.draft })
      const incoming = Object.fromEntries(saved.changes.map(change => [change.path, change.content!]))
      expect(await source.mirror(incoming, {})).toEqual(incoming)
      const paths = saved.snapshot.library.voices[0]!.implementations[source.provider.id]!.localePresets!
      expect(JSON.parse(incoming[paths['ja-JP']!.presetPath]!)).toMatchObject({ language: 'Japanese', model: template.model, revision: template.revision, weightSha256: template.weightSha256 })
      expect(JSON.parse(incoming[paths['en-US']!.presetPath]!)).toMatchObject({ language: 'English', characters: [{ description: '  Calm original direction.  \n\nVoice characteristics:\nPreferred pitch: low\nPreferred pace: slow' }] })
      const wrongLanguage = { ...incoming, [paths['ja-JP']!.presetPath]: encode({ ...JSON.parse(incoming[paths['ja-JP']!.presetPath]!), language: 'Chinese' }) }
      await expect(source.mirror(wrongLanguage, {})).rejects.toThrow('VOICE_DESIGN_PRESET_UNTRUSTED')
      const changedIntent = JSON.parse(incoming[VOICE_DESIGN_LIBRARY_PATH]!)
      changedIntent.voices[0].design.intent.pace = 'fast'
      await expect(source.mirror({ ...incoming, [VOICE_DESIGN_LIBRARY_PATH]: encode(changedIntent) }, {})).rejects.toThrow('VOICE_DESIGN_PRESET_UNTRUSTED')
    }
    finally { await source.close() }
  })

  it('changes the actual inspected conditioning and input fingerprint when locale or intent changes', async () => {
    const source = await fixture()
    try {
      const first = await source.host.saveVersion({ expectedRevision: (await source.host.read()).revision, draft: source.draft })
      const second = await source.host.saveVersion({ expectedRevision: first.snapshot.revision, draft: { ...source.draft, id: 'qwen-designed-v2', version: '2', intent: { pitch: 'high', pace: 'fast' }, supersedes: { id: source.draft.id, version: '1' } } })
      async function fingerprint(voice: string, locale: string) {
        const inspection = await runVoicePreview({ root: source.root, config: source.config, voice, locale, character: 'hero', text: 'The same line.', list: true })
        if (!('characters' in inspection))
          throw new Error('Expected read-only inspection')
        const actual = inspection.characters[0]!.generation!
        const input = { spokenText: 'The same line.', locale, speakerId: 'hero', providerId: source.provider.id, voiceId: actual.providerVoiceId, model: actual.model, voiceProfileRevision: 'd'.repeat(64), parameters: canonicalVoiceGenerationParameters(inspection, 'hero', inspection.presetSha256!) }
        return { actual, hash: await voiceInputFingerprint(input), presetSha256: inspection.presetSha256 }
      }
      const english = await fingerprint(source.draft.id, 'en-US')
      const japanese = await fingerprint(source.draft.id, 'ja-JP')
      const changed = await fingerprint('qwen-designed-v2', 'en-US')
      expect(japanese.presetSha256).not.toBe(english.presetSha256)
      expect(japanese.hash).not.toBe(english.hash)
      expect(changed.actual.providerVoiceId).not.toBe(english.actual.providerVoiceId)
      expect(changed.presetSha256).not.toBe(english.presetSha256)
      expect(changed.hash).not.toBe(english.hash)
      expect(second.snapshot.library.voices).toHaveLength(2)
    }
    finally { await source.close() }
  })

  it('keeps approved legacy preset bytes unchanged through mirror sync and standard project preparation', async () => {
    const source = await fixture()
    try {
      const path = 'authoring/voices/designs/qwen-legacy/1/en-US/qwen-tts.json'
      const preset = encode({ ...template, characters: [{ id: 'hero', text: '这是音色试听。', description: 'Original legacy description' }] })
      const draft: VoiceDesignDraft = { ...source.draft, id: 'qwen-legacy', intent: { pitch: 'high' }, locales: { 'en-US': source.draft.locales['en-US']! } }
      const entry = { preset: 'design-qwen-legacy-en-US', character: 'hero', presetPath: path, presetSha256: digest(preset), localePresets: { 'en-US': { preset: 'design-qwen-legacy-en-US', presetPath: path, presetSha256: digest(preset) } } }
      const library = addVoiceDesignVersion({ schemaVersion: 1, voices: [] }, draft, { [source.provider.id]: entry })
      const files = { [VOICE_DESIGN_LIBRARY_PATH]: encode(library), [path]: preset }
      expect(await source.mirror(files, files)).toEqual(files)
      await mkdir(join(source.root, 'authoring/voices/designs/qwen-legacy/1/en-US'), { recursive: true })
      await writeFile(join(source.root, path), preset)
      await writeFile(join(source.root, VOICE_DESIGN_LIBRARY_PATH), files[VOICE_DESIGN_LIBRARY_PATH])
      const catalogPath = join(source.root, 'adv/assets.json')
      const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
      catalog.assets.push({ id: 'legacy-ui', type: 'audio', kind: 'ui', path: 'legacy-ui.wav', sha256: source.sha256, bytes: source.bytes.length })
      await writeFile(catalogPath, encode(catalog))
      await writeFile(join(source.root, 'public/media/legacy-ui.wav'), source.bytes)
      expect((await source.host.read()).library.voices[0]!.design!.intent).toEqual({ pitch: 'high' })
      const prepared = await prepareProjectGame(await loadProject({ root: source.root, allowEmptyAssetManifest: true }))
      expect(prepared.game.chapters).toHaveLength(1)
      expect(await readFile(join(source.root, path), 'utf8')).toBe(preset)
      expect(JSON.stringify(prepared.game)).not.toContain('Original legacy description')
      await expect(source.mirror(files, {})).rejects.toThrow('VOICE_DESIGN_PRESET_UNTRUSTED')
    }
    finally { await source.close() }
  })
})
