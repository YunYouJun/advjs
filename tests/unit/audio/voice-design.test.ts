import { addVoiceDesignVersion, applyDesignedVoiceProfile, parseVoiceDesignDraft, parseVoiceDesignLibrary, voiceDesignVersion } from '@advjs/audio'
import { describe, expect, it } from 'vitest'

const draft = { id: 'hero-v1', version: '1', characterId: 'hero', label: 'Hero', intent: { speakingStyle: '柔和' }, locales: { 'zh-CN': { providers: { tts: { preset: 'trusted', source: 'system' as const, providerVoiceId: 'system:soft' } } } } }

describe('shared voice design versions', () => {
  it('keeps legacy author metadata and immutable version IDs without ambiguous CLI lookup', () => {
    const legacy = { schemaVersion: 1 as const, authorNote: 'preserve', voices: [{ id: 'legacy', version: '0', characterId: 'hero', label: 'Old', implementations: { tts: { preset: 'trusted' } }, custom: { note: 'preserve' } }] }
    const added = addVoiceDesignVersion(parseVoiceDesignLibrary(legacy), draft, {})
    expect(added).toMatchObject({ authorNote: 'preserve', voices: [{ custom: { note: 'preserve' } }, { id: draft.id }] })
    expect(() => addVoiceDesignVersion(added, draft, {})).toThrow('VERSION_IMMUTABLE')
    expect(() => parseVoiceDesignDraft({ ...draft, supersedes: { id: draft.id, version: '0' } })).toThrow('NEW_VERSION_ID_REQUIRED')
    const next = addVoiceDesignVersion(added, { ...draft, id: 'hero-v2', version: '2', supersedes: { id: 'hero-v1', version: '1' } }, {})
    expect(next.voices.map(voice => voice.id)).toEqual(['legacy', 'hero-v1', 'hero-v2'])
  })

  it('rejects unknown capability input, model paths, credentials and unauthorized clones', () => {
    for (const binding of [{ preset: 'trusted', source: 'unknown' }, { preset: 'trusted', source: 'system', providerVoiceId: 'soft', model: '/weights' }, { preset: 'trusted', source: 'designed', description: 'soft', apiKey: 'private' }, { preset: 'trusted', source: 'cloned', reference: { assetId: 'reference/a', sha256: 'a'.repeat(64) } }])
      expect(() => parseVoiceDesignDraft({ ...draft, locales: { 'zh-CN': { providers: { tts: binding } } } })).toThrow()
  })

  it('requires reviewed exact-locale sample and explicit profile replacement without editing a ledger', () => {
    const library = addVoiceDesignVersion({ schemaVersion: 1, voices: [] }, draft, {})
    const voice = voiceDesignVersion(library, draft.id)
    const sample = { assetId: 'audio/sample', sha256: 'a'.repeat(64), bytes: 100, locale: 'zh-CN', providerId: 'tts', providerVoiceId: 'system:soft', model: 'trusted-model', source: 'system' as const, text: '试听', presetSha256: 'b'.repeat(64), createdAt: '2026-10-11T00:00:00Z' }
    expect(() => applyDesignedVoiceProfile(undefined, voice, 'zh-CN', 'tts', sample)).toThrow('REVIEWED_SAMPLE_REQUIRED')
    voice.design.samples.push(sample)
    voice.design.selectedSamples['zh-CN'] = { tts: { assetId: sample.assetId, sha256: sample.sha256 } }
    const prior = { intent: {}, locales: { 'en-US': { providers: { tts: { source: 'system' as const, voiceId: 'english' } } }, 'zh-CN': { providers: { tts: { source: 'system' as const, voiceId: 'old' } } } } }
    expect(() => applyDesignedVoiceProfile(prior, voice, 'zh-CN', 'tts', sample)).toThrow('REPLACE_REQUIRED')
    const profile = applyDesignedVoiceProfile(prior, voice, 'zh-CN', 'tts', sample, true)
    expect(profile.locales?.['zh-CN']?.providers.tts).toMatchObject({ voiceId: 'system:soft', projectVoiceId: draft.id, projectVoiceVersion: '1' })
    expect(profile.locales?.['en-US']).toEqual(prior.locales['en-US'])
    expect(prior.locales['zh-CN'].providers.tts.voiceId).toBe('old')
  })
})
