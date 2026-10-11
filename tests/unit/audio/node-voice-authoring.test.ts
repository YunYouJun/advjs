// @vitest-environment node
import type { AdvConfig, AdvVoiceSynthesisProvider } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNodeVoiceAuthoringService, runVoiceBindTake, runVoiceGenerateTake, runVoiceLedger } from '../../../packages/advjs/node/audio/voice'
import { createVoiceTakeEditPlan } from '../../../packages/audio/src/authoring'
import { audioFingerprint } from '../../../packages/audio/src/fingerprint'

const lineId = 'line_019b1ca0-0000-7000-8000-000000000001'
let root: string
let config: Partial<AdvConfig>
let provider: AdvVoiceSynthesisProvider
const bytes = Buffer.from('fake WAV output')

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-audio-authoring-')))
  await mkdir(join(root, 'adv'), { recursive: true })
  await mkdir(join(root, 'public'), { recursive: true })
  await writeFile(join(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'project-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: [] }))
  await writeFile(join(root, 'preset.json'), JSON.stringify({ characters: [{ id: 'hero', text: '你好' }] }))
  provider = {
    id: 'fake-tts',
    capabilities: { backend: 'local', synthesis: true, voiceCreation: false, offline: true, models: [{ id: 'test-model', modes: ['system'], formats: ['audio/wav'], streaming: false }] },
    inspectPreset: vi.fn(async request => ({ characters: [{ id: 'hero', name: 'Hero', text: request.text ?? '你好' }] })),
    synthesize: vi.fn(async (request) => {
      await writeFile(join(root, 'candidate.wav'), bytes)
      return { provider: 'fake-tts', preset: 'preset', manifestPath: 'manifest.json', manifest: { seed: 42 }, candidates: [{ id: 'candidate', provider: 'fake-tts', characterId: 'hero', text: request.text ?? '你好', path: 'candidate.wav', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, model: 'test-model', providerVoiceId: 'system:test' }] }
    }),
  }
  config = { authoring: { voice: { providers: [provider], defaultProvider: provider.id, defaultPreset: 'preset', presets: { preset: 'preset.json' } } } }
})
afterEach(async () => await rm(root, { recursive: true, force: true }))

describe('native shared dialogue authoring', () => {
  async function writeStory(text: string) {
    await mkdir(join(root, 'adv/chapters'), { recursive: true })
    await mkdir(join(root, 'adv/settings'), { recursive: true })
    await writeFile(join(root, 'adv.config.json'), JSON.stringify({ root: 'adv', format: 'adv-md' }))
    await writeFile(join(root, 'adv/settings/game.json'), JSON.stringify({ locale: 'zh-CN', characters: [{ id: 'hero', name: 'Hero' }] }))
    await writeFile(join(root, 'adv/chapters/intro.adv.md'), `@Hero\n${text} {#${lineId}}`)
  }

  it('uses current source-language text after an earlier localized ledger snapshot', async () => {
    await writeStory('Earlier text')
    const initial = await runVoiceLedger({ root, config })
    const earlier = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', expectedRevision: initial.revision })
    expect(earlier.ledger.lines[lineId]!.locales['zh-CN']!.displayText).toBe('Earlier text')
    await writeStory('Current text')
    const generated = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', expectedRevision: earlier.revision })
    expect(provider.synthesize).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Current text' }))
    expect(generated.ledger.lines[lineId]!.locales['zh-CN']!.takes.at(-1)?.spokenText).toBe('Current text')
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', displayText: 'Earlier text', expectedRevision: generated.revision })).rejects.toThrow('current dialogue text')
  })

  it('rejects a changed dialogue source under the commit lock after synthesis', async () => {
    await writeStory('Reviewed text')
    const synthesize = provider.synthesize
    provider.synthesize = async (request) => {
      const result = await synthesize(request)
      await writeFile(join(root, 'adv/chapters/intro.adv.md'), `@Hero\nChanged text {#${lineId}}`)
      return result
    }
    const initial = await runVoiceLedger({ root, config })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', expectedRevision: initial.revision })).rejects.toThrow('reviewed dialogue source changed')
    expect((await runVoiceLedger({ root, config })).ledger.lines).toEqual({})
    expect(await readdir(join(root, 'public'))).toEqual([])
  })

  it('freezes the native character profile and canonical inspected parameters for single-line and batch fingerprints', async () => {
    const profile = { intent: { speakingStyle: 'calm' }, locales: { 'zh-CN': { providers: { 'fake-tts': { voiceId: 'system:test', model: 'test-model', source: 'system' as const } } } } }
    await mkdir(join(root, 'adv/characters'), { recursive: true })
    await writeFile(join(root, 'adv/characters/hero.character.md'), `---\nid: hero\nname: Hero\nvoiceProfile: ${JSON.stringify(profile)}\n---\n`)
    provider.inspectPreset = vi.fn(async request => ({ characters: [{ id: 'hero', name: 'Hero', text: request.text ?? '你好', generation: { model: 'test-model', providerVoiceId: 'system:test', source: 'system', mimeType: 'audio/wav', parameters: { fixture: true, seed: 42 } } }] }))
    const initial = await runVoiceLedger({ root, config })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'ja-JP', speakerId: 'hero', displayText: '夜晚', expectedRevision: initial.revision })).rejects.toThrow('VOICE_PROFILE_MISMATCH')
    expect(provider.synthesize).not.toHaveBeenCalled()
    const generated = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })
    const take = generated.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
    expect(take.voiceProfileRevision).toBe(await audioFingerprint(profile))
    expect(take.parameters).toEqual({ fixture: true, seed: 42, preset: 'preset', presetSha256: createHash('sha256').update(await readFile(join(root, 'preset.json'))).digest('hex') })
  })

  it('rejects native character changes during synthesis before registering any take or immutable media', async () => {
    const profile = { intent: {}, locales: { 'zh-CN': { providers: { 'fake-tts': { voiceId: 'system:test', model: 'test-model', source: 'system' as const } } } } }
    await mkdir(join(root, 'adv/characters'), { recursive: true })
    const path = join(root, 'adv/characters/hero.character.md')
    const source = `---\nid: hero\nname: Hero\nvoiceProfile: ${JSON.stringify(profile)}\n---\n`
    await writeFile(path, source)
    provider.inspectPreset = vi.fn(async request => ({ characters: [{ id: 'hero', name: 'Hero', text: request.text ?? '你好', generation: { model: 'test-model', providerVoiceId: 'system:test', source: 'system', mimeType: 'audio/wav' } }] }))
    const synthesize = provider.synthesize
    provider.synthesize = async (request) => {
      const result = await synthesize(request)
      await writeFile(path, `${source}\nChanged character notes.\n`)
      return result
    }
    const initial = await runVoiceLedger({ root, config })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })).rejects.toThrow('reviewed project character changed')
    expect((await runVoiceLedger({ root, config })).ledger.lines).toEqual({})
    expect(await readdir(join(root, 'public'))).toEqual([])
  })

  it('rejects conflicting actual synthesis parameters before take registration', async () => {
    provider.inspectPreset = vi.fn(async request => ({ characters: [{ id: 'hero', name: 'Hero', text: request.text ?? '你好', generation: { model: 'test-model', providerVoiceId: 'system:test', source: 'system', mimeType: 'audio/wav', parameters: { seed: 7 } } }] }))
    const initial = await runVoiceLedger({ root, config })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })).rejects.toThrow('VOICE_PROVENANCE_CHANGED')
    expect((await runVoiceLedger({ root, config })).ledger.lines).toEqual({})
  })

  it('uses the exact project narrator profile without adding a fabricated character and rejects unconfigured locales before synthesis', async () => {
    provider.inspectPreset = vi.fn(async request => ({ characters: [{ id: request.character ?? 'hero', name: 'Narrator', text: request.text ?? '你好', generation: { model: 'test-model', providerVoiceId: 'system:test', source: 'system', mimeType: 'audio/wav' } }] }))
    provider.synthesize = vi.fn(async (request) => {
      await writeFile(join(root, 'candidate.wav'), bytes)
      return { provider: 'fake-tts', preset: 'preset', manifestPath: 'manifest.json', manifest: {}, candidates: [{ id: 'candidate', provider: 'fake-tts', characterId: request.character ?? 'hero', text: request.text ?? '你好', path: 'candidate.wav', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, model: 'test-model', providerVoiceId: 'system:test' }] }
    })
    const service = await createNodeVoiceAuthoringService({ root, config })
    const initial = await service.readVoiceProfiles()
    const narrator = { intent: {}, locales: { 'zh-CN': { providers: { 'fake-tts': { voiceId: 'system:test', model: 'test-model', source: 'system' as const } } } } }
    const saved = await service.saveVoiceProfiles({ expectedRevision: initial.revision, profiles: { ...initial.profiles, narrator } })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'ja-JP', speakerId: 'narrator', displayText: '夜晚', expectedRevision: saved.revision })).rejects.toThrow('PROFILE_MISMATCH')
    expect(provider.synthesize).not.toHaveBeenCalled()
    const generated = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'narrator', displayText: '夜晚', expectedRevision: saved.revision })
    expect(generated.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!.voiceProfileRevision).toBe(await audioFingerprint(narrator))
    expect(generated.narratorProfile).toEqual(narrator)
    expect(await readdir(join(root, 'adv'))).not.toContain('characters')
  })
  it('saves the same versioned dictionary and uses it for CLI generation before binding', async () => {
    const service = await createNodeVoiceAuthoringService({ root, config })
    const initial = await service.readPronunciation()
    const saved = await service.savePronunciation({ expectedRevision: initial.revision, dictionary: { ...initial.dictionary, replacements: { 你好: '您好' } } })
    expect(saved.dictionary.revision).toBe(1)
    expect(JSON.parse(await readFile(join(root, 'adv/audio/pronunciation.json'), 'utf8'))).toEqual(saved.dictionary)
    await expect(service.savePronunciation({ expectedRevision: initial.revision, dictionary: initial.dictionary })).rejects.toThrow('VOICE_CONFLICT')
    const generated = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: saved.revision })
    expect(provider.synthesize).toHaveBeenCalledWith(expect.objectContaining({ text: '您好' }))
    expect(generated.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]).toMatchObject({ spokenText: '您好', pronunciationRevision: expect.stringMatching(/^[a-f0-9]{64}$/u) })
  })

  it('rejects a dictionary changed during read-only preset inspection before calling synthesis', async () => {
    const initial = await runVoiceLedger({ root, config })
    provider.inspectPreset = vi.fn(async (request) => {
      await mkdir(join(root, 'adv/audio'), { recursive: true })
      await writeFile(join(root, 'adv/audio/pronunciation.json'), JSON.stringify({ schemaVersion: 1, revision: 1, replacements: { 你好: 'changed' }, locales: {} }))
      return { characters: [{ id: 'hero', name: 'Hero', text: request.text ?? '你好' }] }
    })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })).rejects.toThrow('VOICE_CONFLICT')
    expect(provider.synthesize).not.toHaveBeenCalled()
  })
  it('reads without preparing providers or creating the canonical ledger', async () => {
    const snapshot = await runVoiceLedger({ root, config })
    expect(snapshot.ledger).toEqual({ schemaVersion: 1, lines: {} })
    expect(snapshot.revision).toMatch(/^[a-f0-9]{64}$/u)
    expect(await readdir(join(root, 'adv'))).toEqual(['assets.json'])
    expect(provider.inspectPreset).not.toHaveBeenCalled()
    expect(provider.synthesize).not.toHaveBeenCalled()
  })

  it('reuses the installed synthesis registry, imports immutable media, and binds explicitly', async () => {
    const snapshot = await runVoiceLedger({ root, config })
    const generated = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-cn', speakerId: 'hero', displayText: '**你好**', expectedRevision: snapshot.revision })
    const binding = generated.ledger.lines[lineId]!.locales['zh-CN']!
    expect(binding.selectedTake).toBeNull()
    expect(binding.takes).toHaveLength(1)
    expect(binding.takes[0]).toMatchObject({ providerId: 'fake-tts', voiceId: 'system:test', model: 'test-model', spokenText: '你好', parameters: { seed: 42 } })
    expect(provider.synthesize).toHaveBeenCalledTimes(1)
    const registered = generated.catalog.assets[0]!
    expect(await readFile(join(root, 'public', registered.path!))).toEqual(bytes)
    expect(JSON.parse(await readFile(join(root, 'adv/audio/voice-ledger.json'), 'utf8'))).toEqual(generated.ledger)
    const selected = await runVoiceBindTake({ root, config, lineId, locale: 'zh-CN', takeId: binding.takes[0]!.id, expectedRevision: generated.revision })
    expect(selected.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBe(binding.takes[0]!.id)
    await expect(runVoiceBindTake({ root, config, lineId, locale: 'zh-CN', takeId: null, expectedRevision: selected.revision })).rejects.toThrow('replaceSelected')
    await expect(runVoiceBindTake({ root, config, lineId, locale: 'ja-JP', takeId: binding.takes[0]!.id, expectedRevision: selected.revision })).rejects.toThrow('locale')
    await expect(runVoiceBindTake({ root, config, lineId, locale: 'zh-CN', takeId: null, expectedRevision: generated.revision, replaceSelected: true })).rejects.toThrow('VOICE_CONFLICT')
  })

  it('preserves split native catalog fragments and registers only in the audio fragment', async () => {
    await mkdir(join(root, 'adv/assets'))
    await writeFile(join(root, 'adv/assets/images.json'), JSON.stringify({ schemaVersion: 2, assets: [{ id: 'bg', type: 'image', kind: 'background', path: 'bg.png' }] }))
    const source = { schemaVersion: 2, id: 'project-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, includes: ['assets/images.json'], authorMetadata: { note: 'preserve' } }
    await writeFile(join(root, 'adv/assets.json'), JSON.stringify(source))
    const originalImages = await readFile(join(root, 'adv/assets/images.json'), 'utf8')
    const initial = await runVoiceLedger({ root, config })
    const generated = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })
    expect(generated.catalog.assets).toHaveLength(2)
    expect(JSON.parse(await readFile(join(root, 'adv/assets.json'), 'utf8'))).toMatchObject({ includes: ['assets/images.json', 'assets/audio.json'], authorMetadata: source.authorMetadata })
    expect(await readFile(join(root, 'adv/assets/images.json'), 'utf8')).toBe(originalImages)
    expect(JSON.parse(await readFile(join(root, 'adv/assets/audio.json'), 'utf8')).assets[0].id).toMatch(/^audio_/u)
  })

  it('verifies persisted media bytes again before adopting a selected take', async () => {
    const initial = await runVoiceLedger({ root, config })
    const generated = await runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })
    await writeFile(join(root, 'public', generated.catalog.assets[0]!.path!), 'changed audio')
    await expect(runVoiceBindTake({ root, config, lineId, locale: 'zh-CN', takeId: generated.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!.id, expectedRevision: generated.revision })).rejects.toThrow('media hash or size')
    expect((await runVoiceLedger({ root, config })).ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
  })

  it('rejects revision conflicts before synthesis and before registration', async () => {
    const initial = await runVoiceLedger({ root, config })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: 'stale' })).rejects.toThrow('VOICE_CONFLICT')
    expect(provider.synthesize).not.toHaveBeenCalled()
    const original = provider.synthesize
    provider.synthesize = async (request) => {
      const generated = await original(request)
      const source = JSON.parse(await readFile(join(root, 'adv/assets.json'), 'utf8'))
      source.assets.push({ id: 'unrelated', type: 'image', kind: 'background', path: 'unrelated.png' })
      await writeFile(join(root, 'adv/assets.json'), JSON.stringify(source))
      return generated
    }
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })).rejects.toThrow('VOICE_CONFLICT')
    expect(await readdir(join(root, 'public'))).toEqual([])
    expect((await runVoiceLedger({ root, config })).ledger.lines).toEqual({})
  })

  it('checks reference consent before downloading models or invoking a provider', async () => {
    provider.inspectPreset = vi.fn(async request => ({ characters: [{ id: 'hero', name: 'Hero', text: request.text ?? '你好', referenceAssetId: 'voice-reference' }] }))
    const initial = await runVoiceLedger({ root, config })
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision })).rejects.toThrow('before generation')
    expect(provider.synthesize).not.toHaveBeenCalled()
  })

  it('requires an in-project consent file and prevents reference-source substitution', async () => {
    provider.inspectPreset = vi.fn(async request => ({ characters: [{ id: 'hero', name: 'Hero', text: request.text ?? '你好', referenceAssetId: 'voice-reference' }] }))
    const initial = await runVoiceLedger({ root, config })
    const rights = { license: 'project-content', subject: 'Actor', consentRecord: 'authoring/consent.json' }
    const options = { root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', expectedRevision: initial.revision, rights }
    await expect(runVoiceGenerateTake({ ...options, source: 'system' })).rejects.toThrow('cloned source')
    await expect(runVoiceGenerateTake({ ...options, source: 'cloned' })).rejects.toThrow('CONSENT_RECORD_MISSING')
    expect(provider.synthesize).not.toHaveBeenCalled()
    await mkdir(join(root, 'authoring'))
    await writeFile(join(root, rights.consentRecord), JSON.stringify({ actor: rights.subject, licensed: true }))
    const original = provider.synthesize
    provider.synthesize = async (request) => {
      const result = await original(request)
      result.candidates[0]!.providerVoiceId = 'reference:voice-reference:aaaaaaaa'
      return result
    }
    const generated = await runVoiceGenerateTake({ ...options, source: 'cloned' })
    expect(generated.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]).toMatchObject({ source: 'cloned', rights })
  })

  it('freezes the reviewed voice version before generation and detects profile changes', async () => {
    const profile = { id: 'hero-voice', version: 'v1', characterId: 'hero', label: 'Hero', implementations: { 'fake-tts': { preset: 'preset' } } }
    const voiceConfig = config.authoring!.voice!
    voiceConfig.library = 'voices.json'
    await writeFile(join(root, 'voices.json'), JSON.stringify({ schemaVersion: 1, voices: [profile] }))
    const initial = await runVoiceLedger({ root, config })
    const original = provider.synthesize
    provider.synthesize = async (request) => {
      const result = await original(request)
      await writeFile(join(root, 'voices.json'), JSON.stringify({ schemaVersion: 1, voices: [{ ...profile, version: 'v2' }] }))
      return result
    }
    await expect(runVoiceGenerateTake({ root, config, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', voice: 'hero-voice', expectedRevision: initial.revision })).rejects.toThrow('Voice Profile changed')
    expect((await runVoiceLedger({ root, config })).catalog.assets).toEqual([])
    expect(await readdir(join(root, 'public'))).toEqual([])
  })

  it('checks consent documents for direct native registration and when adopting historical cloned takes', async () => {
    const service = await createNodeVoiceAuthoringService({ root, config })
    const state = await service.read()
    const result = await service.synthesize({ lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好' })
    const rights = { license: 'project-license', subject: 'Actor', consentRecord: 'authoring/consent.json' }
    const input = { expectedRevision: state.revision, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', candidate: result.candidates[0]!, assetPath: 'audio/cloned.wav', voiceProfileRevision: 'a'.repeat(64), source: 'cloned' as const, rights }
    await expect(service.register(input)).rejects.toThrow('CONSENT_RECORD_MISSING')
    for (const path of ['authoring\\consent.json', 'authoring/./consent.json', 'authoring//consent.json', '.git/config', 'node_modules/package.json'])
      await expect(service.register({ ...input, rights: { ...rights, consentRecord: path } })).rejects.toThrow('CONSENT_RECORD_INVALID')
    expect((await service.read()).ledger.lines).toEqual({})
    expect(await readdir(join(root, 'public'))).toEqual([])
    await mkdir(join(root, 'authoring'))
    await writeFile(join(root, rights.consentRecord), JSON.stringify({ actor: rights.subject, consent: true }))
    const registered = await service.register(input)
    const binding = registered.ledger.lines[lineId]!.locales['zh-CN']!
    await rm(join(root, rights.consentRecord))
    await expect(service.select({ lineId, locale: 'zh-CN', takeId: binding.takes[0]!.id, expectedRevision: registered.revision })).rejects.toThrow('CONSENT_RECORD_MISSING')
    expect((await service.read()).ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
  })

  it('rejects unsafe canonical files and immutable destination collisions without committing facts', async () => {
    const external = await realpath(await mkdtemp(join(tmpdir(), 'advjs-audio-external-')))
    try {
      await symlink(external, join(root, 'adv/audio'))
      await expect(runVoiceLedger({ root, config })).rejects.toThrow('outside')
    }
    finally {
      await rm(join(root, 'adv/audio'), { force: true })
      await rm(external, { recursive: true, force: true })
    }
    const service = await createNodeVoiceAuthoringService({ root, config })
    const initial = await service.read()
    const result = await service.synthesize({ lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好' })
    await writeFile(join(root, 'public/exists.wav'), 'immutable original')
    const catalogBefore = await readFile(join(root, 'adv/assets.json'), 'utf8')
    const plan = await createVoiceTakeEditPlan(initial, { expectedRevision: initial.revision, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', candidate: result.candidates[0]!, assetPath: 'exists.wav', voiceProfileRevision: 'a'.repeat(64), source: 'system' })
    // The finite native adapter is exercised through the same service operation.
    await expect(service.register({ expectedRevision: plan.expectedRevision, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', candidate: result.candidates[0]!, assetPath: 'exists.wav', voiceProfileRevision: 'a'.repeat(64), source: 'system' })).rejects.toThrow('EEXIST')
    expect(await readFile(join(root, 'adv/assets.json'), 'utf8')).toBe(catalogBefore)
    expect(await readFile(join(root, 'public/exists.wav'), 'utf8')).toBe('immutable original')
    expect((await service.read()).ledger.lines).toEqual({})
  })
})
