// @vitest-environment node
import type { AdvAssetManifest, AdvVoiceCandidate } from '@advjs/types'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createVoiceTakeEditPlan, voiceAuthoringRevision } from '../../../packages/audio/src/authoring'
import { audioFingerprint } from '../../../packages/audio/src/fingerprint'
import { voiceGenerationInputFingerprint } from '../../../packages/audio/src/jobs/planner'
import { createProjectAudioService } from '../../../packages/audio/src/project-files'
import { AUDIO_PRONUNCIATION_PATH, createAudioPronunciationDictionary, parseAudioPronunciationDictionary } from '../../../packages/audio/src/pronunciation'
import { prepareVoiceSpokenText, resolveVoiceSpokenText } from '../../../packages/audio/src/spoken-text'
import { resolveVoiceTake } from '../../../packages/audio/src/voice-ledger'
import { AUDIO_VOICE_PROFILES_PATH, createAudioVoiceProfiles, parseAudioVoiceProfiles } from '../../../packages/audio/src/voice-profiles'

const hash = 'a'.repeat(64)
const lineId = 'line_019b1ca0-0000-7000-8000-000000000001'
const catalog: AdvAssetManifest = { schemaVersion: 2, id: 'assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: [] }
const dictionary = { schemaVersion: 1 as const, revision: 1, replacements: { 'ADV': '冒险', 'ADV.JS': '冒险引擎', '冒险': '不应再次替换' }, locales: { 'zh-CN': { replacements: { 'ADV.JS': '中文引擎' } } } }
const candidate: AdvVoiceCandidate = { id: 'candidate', characterId: 'hero', text: '中文引擎', path: 'candidate.wav', sha256: hash, bytes: 120, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, provider: 'fake-tts', model: 'model', providerVoiceId: 'voice' }
const input = { lineId, locale: 'zh-CN', speakerId: 'hero', displayText: 'ADV.JS', assetPath: 'voice/test.wav', voiceProfileRevision: hash, source: 'system' as const, providerId: 'fake-tts', voiceId: 'voice', model: 'model' }

function project() {
  const files: Record<string, string> = { 'adv/assets.json': JSON.stringify(catalog) }
  const synthesize = vi.fn(async ({ text }: { text: string }) => ({ provider: 'fake-tts', preset: 'preset', manifestPath: 'candidate.json', manifest: {}, candidates: [{ ...candidate, text }] }))
  const commit = vi.fn(async (changes: Array<{ path: string, expected: string | null, content: string | null }>) => {
    for (const change of changes) {
      if ((files[change.path] ?? null) !== change.expected)
        throw new Error('VOICE_CONFLICT')
    }
    for (const change of changes) {
      if (change.content === null)
        delete files[change.path]
      else files[change.path] = change.content
    }
  })
  const service = createProjectAudioService({ read: async () => ({ files: { ...files }, catalog: JSON.parse(files['adv/assets.json']!) }), commit, synthesize, verifySelection: async () => {} })
  return { service, files, synthesize, commit }
}

describe('authoritative project pronunciation dictionary', () => {
  it('uses exact locales, longest single-pass literal matches, and explicit author overrides', () => {
    expect(resolveVoiceSpokenText('**ADV.JS** ADV', { locale: 'zh-CN', pronunciation: dictionary })).toBe('中文引擎 冒险')
    expect(resolveVoiceSpokenText('ADV.JS', { locale: 'zh-TW', pronunciation: dictionary })).toBe('冒险引擎')
    expect(resolveVoiceSpokenText('ADV.JS', { locale: 'zh-CN', pronunciation: dictionary, override: 'ADV.JS' })).toBe('ADV.JS')
    expect(resolveVoiceSpokenText('Price $1.0', { locale: 'en-US', pronunciation: { ...dictionary, replacements: { '$1.0': '$2' }, locales: {} } })).toBe('Price $2')
  })

  it('rejects malformed locales, executable markup, variables, excessive entries and replacement expansion', () => {
    for (const replacements of [{ '': 'x' }, { x: '<speak>bad</speak>' }, { x: '{{name}}' }, { x: 'a'.repeat(257) }, Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`key${index}`, 'value']))])
      expect(() => parseAudioPronunciationDictionary({ ...dictionary, replacements })).toThrow()
    expect(() => parseAudioPronunciationDictionary({ ...dictionary, locales: { 'zh-cn': { replacements: {} } } })).toThrow('LOCALE_INVALID')
    expect(() => resolveVoiceSpokenText('x'.repeat(1000), { locale: 'zh-CN', pronunciation: { ...dictionary, replacements: { x: 'y'.repeat(256) } } })).toThrow('LIMIT')
  })

  it('reads without mutation and saves monotonically through the same guarded CAS transaction', async () => {
    const { service, files, commit } = project()
    const initial = await service.readPronunciation()
    expect(initial.dictionary).toEqual(createAudioPronunciationDictionary())
    expect(Object.keys(files)).toEqual(['adv/assets.json'])
    const saved = await service.savePronunciation({ expectedRevision: initial.revision, dictionary: { ...dictionary, revision: 0 } })
    expect(saved.dictionary.revision).toBe(1)
    expect(saved.revision).not.toBe(initial.revision)
    expect(JSON.parse(files[AUDIO_PRONUNCIATION_PATH]!)).toEqual(saved.dictionary)
    expect(commit.mock.calls[0]![0].map(change => change.path)).toContain('adv/audio/voice-ledger.json')
    await expect(service.savePronunciation({ expectedRevision: initial.revision, dictionary: initial.dictionary })).rejects.toThrow('VOICE_CONFLICT')
    await expect(service.savePronunciation({ expectedRevision: saved.revision, dictionary: { ...saved.dictionary, revision: 0 } })).rejects.toThrow('VOICE_CONFLICT')
  })

  it('uses one dictionary for actual synthesis, immutable registration, job fingerprints and byte identity', async () => {
    const { service, synthesize } = project()
    const initial = await service.readPronunciation()
    await service.savePronunciation({ expectedRevision: initial.revision, dictionary: { ...dictionary, revision: 0 } })
    const snapshot = await service.read()
    const generated = await service.synthesize({ ...input, expectedRevision: snapshot.revision })
    expect(synthesize).toHaveBeenCalledWith(expect.objectContaining({ text: '中文引擎' }), undefined)
    const registered = await service.register({ ...input, candidate: generated.candidates[0]!, expectedRevision: snapshot.revision })
    const take = registered.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
    expect(take.spokenText).toBe('中文引擎')
    expect(take.pronunciationRevision).toMatch(/^[a-f0-9]{64}$/u)
    expect(take.inputFingerprint).toBe(await voiceGenerationInputFingerprint(input, snapshot.pronunciation))
    expect(take.sha256).toBe(hash)
    expect(registered.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
  })

  it('changes fingerprints and stale status after dictionary edits without mutating selected take history', async () => {
    const ledger = { schemaVersion: 1 as const, lines: {} }
    const snapshot = { ledger, catalog, pronunciation: dictionary, revision: await voiceAuthoringRevision(ledger, catalog, dictionary) }
    const plan = await createVoiceTakeEditPlan(snapshot, { ...input, candidate, expectedRevision: snapshot.revision })
    const binding = plan.ledger.lines[lineId]!.locales['zh-CN']!
    binding.selectedTake = binding.takes[0]!.id
    const original = JSON.stringify(binding.takes[0])
    const next = { ...dictionary, revision: 2 }
    const prepared = await prepareVoiceSpokenText(input.displayText, { locale: input.locale, pronunciation: next })
    expect(prepared.text).toBe(candidate.text)
    expect(await voiceGenerationInputFingerprint(input, dictionary)).not.toBe(await voiceGenerationInputFingerprint(input, next))
    expect(resolveVoiceTake(plan.ledger, { lineId, locale: input.locale, assets: plan.catalog.assets, spokenText: prepared.text, pronunciationRevision: prepared.pronunciationRevision })).toMatchObject({ warnings: [{ code: 'VOICE_STALE' }] })
    expect(JSON.stringify(binding.takes[0])).toBe(original)
    expect(await voiceGenerationInputFingerprint({ ...input, spokenText: 'Author override' }, dictionary)).toBe(await voiceGenerationInputFingerprint({ ...input, spokenText: 'Author override' }, next))
  })

  it('rejects dictionary changes before synthesis rather than invoking the provider with an unreviewed text', async () => {
    const { service, synthesize } = project()
    const snapshot = await service.read()
    await service.savePronunciation({ expectedRevision: snapshot.revision, dictionary: { ...dictionary, revision: 0 } })
    await expect(service.synthesize({ ...input, expectedRevision: snapshot.revision })).rejects.toThrow('VOICE_CONFLICT')
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('persists a reactive project narrator profile with guarded revision without fabricating a character', async () => {
    const { service, files } = project()
    const initial = await service.readVoiceProfiles()
    expect(initial.profiles).toEqual(createAudioVoiceProfiles())
    const narrator = { intent: { speakingStyle: 'Calm narrator' }, locales: { 'zh-CN': { providers: { 'fake-tts': { voiceId: 'voice', model: 'model', source: 'system' as const } } } } }
    const proposed = reactive({ ...initial.profiles, narrator })
    expect(parseAudioVoiceProfiles(proposed).narrator).toEqual(narrator)
    const saved = await service.saveVoiceProfiles({ expectedRevision: initial.revision, profiles: proposed })
    expect(saved.profiles.revision).toBe(1)
    expect(JSON.parse(files[AUDIO_VOICE_PROFILES_PATH]!)).toEqual(saved.profiles)
    expect((await service.read()).narratorProfile).toEqual(narrator)
    expect((await service.readProjectAudio()).narratorProfile).toEqual(narrator)
    expect(Object.keys(files).some(path => path.includes('characters'))).toBe(false)
    await expect(service.saveVoiceProfiles({ expectedRevision: initial.revision, profiles: proposed })).rejects.toThrow('VOICE_CONFLICT')
  })

  it('checks exact narrator voice identity and profile fingerprint before accepting immutable narration takes', async () => {
    const { service } = project()
    const initial = await service.readVoiceProfiles()
    const narrator = { intent: {}, locales: { 'zh-CN': { providers: { 'fake-tts': { voiceId: 'voice', model: 'model', source: 'system' as const } } } } }
    await service.saveVoiceProfiles({ expectedRevision: initial.revision, profiles: { ...initial.profiles, narrator } })
    const snapshot = await service.read()
    const binding = { ...input, speakerId: 'narrator', candidate: { ...candidate, characterId: 'narrator', text: 'ADV.JS' }, voiceProfileRevision: await audioFingerprint(narrator), expectedRevision: snapshot.revision }
    const plan = await createVoiceTakeEditPlan(snapshot, binding)
    expect(plan.ledger.lines[lineId]!.speakerId).toBe('narrator')
    await expect(createVoiceTakeEditPlan(snapshot, { ...binding, voiceProfileRevision: hash })).rejects.toThrow('PROFILE_MISMATCH')
    await expect(createVoiceTakeEditPlan(snapshot, { ...binding, locale: 'zh-TW' })).rejects.toThrow('PROFILE_MISMATCH')
    await expect(createVoiceTakeEditPlan(snapshot, { ...binding, candidate: { ...binding.candidate, providerVoiceId: 'different' } })).rejects.toThrow('PROFILE_MISMATCH')
  })
})
