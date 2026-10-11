// @vitest-environment node
import type { AdvAssetManifest, AdvVoiceCandidate, VoiceAuthoringSnapshot, VoiceLedger, VoiceTake } from '@advjs/types'
import { normalizeAdvAssetManifest } from '@advjs/assets'
import { describe, expect, it, vi } from 'vitest'
import { createVoiceAuthoringService, createVoiceTakeEditPlan, createVoiceTakeSelectionPlan, voiceAuthoringRevision } from '../../../packages/audio/src/authoring'
import { audioFingerprint, canonicalAudioJson, voiceInputFingerprint } from '../../../packages/audio/src/fingerprint'
import { createAudioId, isAudioId } from '../../../packages/audio/src/ids'
import { normalizeAudioLocale } from '../../../packages/audio/src/locale'
import { createProjectAudioService } from '../../../packages/audio/src/project-files'
import { normalizeSpokenText } from '../../../packages/audio/src/spoken-text'
import { createVoiceLedger, findVoiceTakeByFingerprint, mergeVoiceLedgers, parseVoiceLedger, resolveVoiceTake, serializeVoiceLedger, updateVoiceLedgerLine, validateCharacterVoiceProfile } from '../../../packages/audio/src/voice-ledger'

const lineId = 'line_019b1ca0-0000-7000-8000-000000000001'
const otherLineId = 'line_019b1ca0-0000-7000-8000-000000000002'
const takeId = 'take_019b1ca0-0000-7000-8000-000000000001'
const otherTakeId = 'take_019b1ca0-0000-7000-8000-000000000002'
const assetId = 'audio_019b1ca0-0000-7000-8000-000000000001'
const otherAssetId = 'audio_019b1ca0-0000-7000-8000-000000000002'
const hash = 'a'.repeat(64)
const catalog: AdvAssetManifest = { schemaVersion: 2, id: 'assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: [{ id: assetId, type: 'audio', kind: 'voice', path: 'voice.wav', sha256: hash }] }
const take: VoiceTake = { id: takeId, assetId, sha256: hash, providerId: 'openai-tts', voiceId: 'coral', model: 'gpt-4o-mini-tts', voiceProfileRevision: hash, inputFingerprint: hash, spokenText: '你好', createdAt: '2026-10-11T00:00:00Z', source: 'system' }
const candidate: AdvVoiceCandidate = { id: 'candidate', characterId: 'hero', text: '你好', path: '.advjs/voice/previews/candidate.wav', sha256: hash, bytes: 100, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, provider: 'openai-tts', model: 'gpt-4o-mini-tts', providerVoiceId: 'coral' }

function ledger(): VoiceLedger {
  return { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '你好', locales: { 'zh-CN': { selectedTake: takeId, takes: [{ ...take }] } } } } }
}

async function snapshot(): Promise<VoiceAuthoringSnapshot> {
  const value = { ledger: ledger(), catalog: structuredClone(catalog) }
  return { ...value, revision: await voiceAuthoringRevision(value.ledger, value.catalog) }
}

describe('shared audio identities and fingerprints', () => {
  it('permits an empty authoring catalog only through an explicit authoring option', () => {
    const empty = { ...catalog, assets: [] }
    expect(() => normalizeAdvAssetManifest(empty)).toThrow('at least one asset')
    expect(normalizeAdvAssetManifest(empty, { allowEmpty: true }).assets).toEqual([])
    expect(() => normalizeAdvAssetManifest({ ...empty, defaultProfile: 'unknown' }, { allowEmpty: true })).toThrow('does not exist')
  })

  it('generates independently stable UUIDv7 IDs and rejects positional IDs', () => {
    const first = createAudioId('line')
    const second = createAudioId('line')
    expect(isAudioId(first, 'line')).toBe(true)
    expect(first < second).toBe(true)
    expect(isAudioId('line_42', 'line')).toBe(false)
    expect(isAudioId(first.replace(/^([a-z]+_[\da-f]{8}-[\da-f]{4}-)7/u, (_match, prefix: string) => `${prefix}4`), 'line')).toBe(false)
    expect(() => createAudioId('take', -1)).toThrow('48-bit')
  })

  it('canonicalizes locales without matching a different locale', () => {
    expect(normalizeAudioLocale('zh-cn')).toBe('zh-CN')
    expect(normalizeAudioLocale('zh-hant-tw')).toBe('zh-Hant-TW')
    expect(normalizeAudioLocale('ja-jp')).toBe('ja-JP')
    expect(() => normalizeAudioLocale('zh_CN')).toThrow('BCP 47')
    expect(() => normalizeAudioLocale('not a locale')).toThrow('Invalid audio locale')
    expect(resolveVoiceTake(ledger(), { lineId, locale: 'zh-TW', assets: catalog.assets }).take).toBeUndefined()
    expect(resolveVoiceTake(ledger(), { lineId, locale: 'ja-JP', assets: catalog.assets }).take).toBeUndefined()
  })

  it('uses canonical JSON and freezes all voice identity inputs', async () => {
    expect(await audioFingerprint({ z: 1, a: { c: 2, b: 3 } })).toBe(await audioFingerprint({ a: { b: 3, c: 2 }, z: 1 }))
    const input = { spokenText: '你好', locale: 'zh-CN', speakerId: 'hero', providerId: 'openai-tts', voiceId: 'coral', model: 'gpt-4o-mini-tts', voiceProfileRevision: hash }
    for (const field of ['speakerId', 'voiceId', 'voiceProfileRevision', 'model', 'locale', 'spokenText'] as const)
      expect(await voiceInputFingerprint({ ...input, [field]: field === 'locale' ? 'ja-JP' : `different-${input[field]}` })).not.toBe(await voiceInputFingerprint(input))
    expect(await voiceInputFingerprint({ ...input, locale: 'zh-cn' })).toBe(await voiceInputFingerprint(input))
    expect(() => canonicalAudioJson({ value: undefined })).toThrow('JSON values')
    expect(() => canonicalAudioJson({ value: new Map() })).toThrow('JSON values')
    expect(() => canonicalAudioJson({ apiKey: 'secret' })).toThrow('Credentials')
    expect(() => canonicalAudioJson({ url: 'https://example.com/a?X-Amz-Signature=secret' })).toThrow('Signed URLs')
  })

  it('normalizes authoring prose and preserves explicit runtime-variable overrides', () => {
    expect(normalizeSpokenText(`**你好**， [ADV.JS](https://advjs.org) {#${lineId}}`, { pronunciation: { 'ADV.JS': '冒险引擎' } })).toBe('你好， 冒险引擎')
    expect(() => normalizeSpokenText('你好 {{name}}')).toThrow('override')
    expect(normalizeSpokenText('你好 {{name}}', { override: '你好，小明' })).toBe('你好，小明')
  })
})

describe('canonical dialogue ledger', () => {
  it('round trips JSON, narrator, locales and immutable history', () => {
    const input = ledger()
    input.lines[otherLineId] = { speakerId: 'narrator', displayText: '夜晚', locales: { 'ja-JP': { selectedTake: null, takes: [{ ...take, id: otherTakeId, assetId: otherAssetId, source: 'designed' }] } } }
    expect(parseVoiceLedger(serializeVoiceLedger(input))).toEqual(input)
    expect(() => parseVoiceLedger({ ...input, secret: 'value' })).toThrow('Credentials')
    expect(() => parseVoiceLedger({ ...input, schemaVersion: 2 })).toThrow('schemaVersion 1')
    expect(() => parseVoiceLedger({ ...input, extra: true })).toThrow('unknown property')
  })

  it('rejects invalid identity, duplicate takes and noncanonical project locale keys', () => {
    const input = ledger()
    input.lines[lineId]!.locales['zh-cn'] = input.lines[lineId]!.locales['zh-CN']!
    expect(() => parseVoiceLedger(input)).toThrow('canonical BCP 47')
    const duplicate = ledger()
    duplicate.lines[otherLineId] = structuredClone(duplicate.lines[lineId]!)
    expect(() => parseVoiceLedger(duplicate)).toThrow('unique')
    const selected = ledger()
    selected.lines[lineId]!.locales['zh-CN']!.selectedTake = otherTakeId
    expect(() => parseVoiceLedger(selected)).toThrow('missing')
    expect(() => parseVoiceLedger({ schemaVersion: 1, lines: { line_1: input.lines[lineId] } })).toThrow('uuidv7')
    const invalidDate = ledger()
    invalidDate.lines[lineId]!.locales['zh-CN']!.takes[0]!.createdAt = '2026-02-30T00:00:00Z'
    expect(() => parseVoiceLedger(invalidDate)).toThrow('UTC ISO timestamp')
  })

  it('rejects selected asset hash corruption and reports staleness without deleting a take', () => {
    expect(resolveVoiceTake(ledger(), lineId, 'zh-CN', { [assetId]: { kind: 'voice', sha256: hash } }).take?.id).toBe(takeId)
    expect(() => resolveVoiceTake(ledger(), { lineId, locale: 'zh-CN', assets: [{ ...catalog.assets[0]!, sha256: 'b'.repeat(64) }] })).toThrow('SHA-256')
    const edited = updateVoiceLedgerLine(ledger(), lineId, { speakerId: 'hero', displayText: '再见' })
    const result = resolveVoiceTake(edited, { lineId, locale: 'zh-CN', assets: catalog.assets })
    expect(result.take?.id).toBe(takeId)
    expect(result.warnings[0]?.code).toBe('VOICE_STALE')
    expect(resolveVoiceTake(ledger(), { lineId, locale: 'zh-CN', assets: catalog.assets, voiceProfileRevision: 'b'.repeat(64) }).warnings).toHaveLength(1)
    expect(() => updateVoiceLedgerLine(ledger(), lineId, { speakerId: 'narrator', displayText: '你好' })).toThrow('speaker')
  })

  it('merges additions while detecting immutable or selected-take conflicts', () => {
    const incoming = ledger()
    incoming.lines[lineId]!.locales['zh-CN']!.takes.push({ ...take, id: otherTakeId, assetId: otherAssetId })
    expect(mergeVoiceLedgers(ledger(), incoming).lines[lineId]!.locales['zh-CN']!.takes).toHaveLength(2)
    incoming.lines[lineId]!.locales['zh-CN']!.selectedTake = otherTakeId
    expect(() => mergeVoiceLedgers(ledger(), incoming)).toThrow('different takes')
    const modified = ledger()
    modified.lines[lineId]!.locales['zh-CN']!.takes[0]!.model = 'changed'
    expect(() => mergeVoiceLedgers(ledger(), modified)).toThrow('immutable')
  })

  it('reuses only an exact input fingerprint for the same persistent line and locale', () => {
    expect(findVoiceTakeByFingerprint(ledger(), lineId, 'zh-cn', hash)?.id).toBe(takeId)
    expect(findVoiceTakeByFingerprint(ledger(), lineId, 'ja-JP', hash)).toBeUndefined()
    expect(findVoiceTakeByFingerprint(ledger(), otherLineId, 'zh-CN', hash)).toBeUndefined()
    expect(findVoiceTakeByFingerprint(ledger(), lineId, 'zh-CN', 'b'.repeat(64))).toBeUndefined()
    expect(ledger().lines[lineId]!.locales['zh-CN']!.selectedTake).toBe(takeId)
  })

  it('requires auditable rights before accepting cloned Voice Profiles or takes', () => {
    expect(() => validateCharacterVoiceProfile({ intent: {}, locales: { 'zh-CN': { providers: { qwen: { voiceId: 'ref', source: 'cloned' } } } } })).toThrow('consent')
    const input = ledger()
    input.lines[lineId]!.locales['zh-CN']!.takes[0]!.source = 'cloned'
    expect(() => parseVoiceLedger(input)).toThrow('consent')
    input.lines[lineId]!.locales['zh-CN']!.takes[0]!.rights = { license: 'CC-BY-4.0', subject: 'Actor', consentRecord: 'authoring/consent/actor.json' }
    expect(parseVoiceLedger(input)).toEqual(input)
  })
})

describe('editor and Studio shared voice authoring service', () => {
  it('requires an existing canonical consent document for every host registration and new selection', async () => {
    const files: Record<string, string> = { 'adv/assets.json': JSON.stringify(catalog), 'adv/audio/voice-ledger.json': serializeVoiceLedger(createVoiceLedger()) }
    const commit = vi.fn(async () => {})
    const verifySelection = vi.fn(async () => {})
    const service = createProjectAudioService({ read: async () => ({ files, catalog }), commit, verifySelection })
    const state = await service.read()
    const rights = { license: 'project-license', subject: 'Actor', consentRecord: 'authoring/consent/actor.json' }
    const input = { expectedRevision: state.revision, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', candidate, assetPath: 'audio/cloned.wav', voiceProfileRevision: hash, source: 'cloned' as const, rights }
    await expect(service.register(input)).rejects.toThrow('CONSENT_RECORD_MISSING')
    expect(commit).not.toHaveBeenCalled()
    for (const path of ['authoring\\consent.json', 'authoring/./consent.json', 'authoring//consent.json', '.git/config', 'node_modules/package.json']) {
      files[path] = '{}'
      await expect(service.register({ ...input, rights: { ...rights, consentRecord: path } })).rejects.toThrow('CONSENT_RECORD_INVALID')
    }
    expect(commit).not.toHaveBeenCalled()
    files[rights.consentRecord] = JSON.stringify({ actor: 'Actor', consent: true })
    await service.register(input)
    expect(commit).toHaveBeenCalledTimes(1)

    // A historical take cannot be adopted after its consent document is removed.
    const historical = ledger()
    const binding = historical.lines[lineId]!.locales['zh-CN']!
    binding.selectedTake = null
    binding.takes[0]!.source = 'cloned'
    binding.takes[0]!.rights = rights
    files['adv/audio/voice-ledger.json'] = serializeVoiceLedger(historical)
    delete files[rights.consentRecord]
    const revised = await service.read()
    await expect(service.select({ lineId, locale: 'zh-CN', takeId, expectedRevision: revised.revision })).rejects.toThrow('CONSENT_RECORD_MISSING')
    expect(verifySelection).not.toHaveBeenCalled()
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('requires persisted-media verification in every project-file host before selecting', async () => {
    const input = ledger()
    input.lines[lineId]!.locales['zh-CN']!.selectedTake = null
    const files = { 'adv/assets.json': JSON.stringify(catalog), 'adv/audio/voice-ledger.json': serializeVoiceLedger(input) }
    const commit = vi.fn(async () => {})
    const port = { read: async () => ({ files, catalog }), commit }
    const service = createProjectAudioService(port)
    const state = await service.read()
    await expect(service.select({ lineId, locale: 'zh-CN', takeId, expectedRevision: state.revision })).rejects.toThrow('VERIFICATION_REQUIRED')
    expect(commit).not.toHaveBeenCalled()
    const verifySelection = vi.fn(async () => {
      throw new Error('Corrupted media')
    })
    const strictHost = createProjectAudioService({ ...port, verifySelection })
    await expect(strictHost.select({ lineId, locale: 'zh-CN', takeId, expectedRevision: state.revision })).rejects.toThrow('Corrupted media')
    expect(verifySelection).toHaveBeenCalledWith(take, catalog.assets[0], catalog)
    expect(commit).not.toHaveBeenCalled()
  })

  it('registers candidates as unselected immutable takes and selects only explicitly', async () => {
    const state = await snapshot()
    const plan = await createVoiceTakeEditPlan(state, { expectedRevision: state.revision, lineId, locale: 'zh-cn', speakerId: 'hero', displayText: '你好', candidate, assetPath: 'audio/voice/immutable.wav', voiceProfileRevision: hash, source: 'system' })
    expect(plan.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBe(takeId)
    expect(plan.addedTakes).toHaveLength(1)
    expect(state.ledger.lines[lineId]!.locales['zh-CN']!.takes).toHaveLength(1)
    const next = { ledger: plan.ledger, catalog: plan.catalog, revision: 'next' }
    expect(() => createVoiceTakeSelectionPlan(next, { lineId, locale: 'zh-CN', takeId: plan.addedTakes[0]!.id, expectedRevision: 'next' })).toThrow('replaceSelected')
    const selected = createVoiceTakeSelectionPlan(next, { lineId, locale: 'zh-CN', takeId: plan.addedTakes[0]!.id, expectedRevision: 'next', replaceSelected: true })
    expect(selected.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBe(plan.addedTakes[0]!.id)
    expect(() => createVoiceTakeSelectionPlan(next, { lineId, locale: 'zh-CN', takeId: null, expectedRevision: 'stale' })).toThrow('VOICE_CONFLICT')
  })

  it('uses the same JSON protocol for native and browser hosts, cancellation and exact synthesis inputs', async () => {
    let state = await snapshot()
    const synthesize = vi.fn(async () => ({ provider: candidate.provider, preset: 'preset', manifestPath: 'manifest.json', manifest: {}, candidates: [candidate] }))
    const service = createVoiceAuthoringService({
      read: async () => state,
      commit: async (plan) => {
        state = { ledger: plan.ledger, catalog: plan.catalog, revision: await voiceAuthoringRevision(plan.ledger, plan.catalog) }
        return state
      },
      synthesize,
    })
    const result = await service.synthesize({ lineId, locale: 'zh-cn', speakerId: 'hero', displayText: '**你好**' })
    expect(result.candidates[0]).toEqual(candidate)
    expect(synthesize).toHaveBeenCalledWith({ lineId, locale: 'zh-CN', speakerId: 'hero', text: '你好' }, undefined)
    const cancelled = new AbortController()
    cancelled.abort(new Error('cancelled'))
    await expect(service.synthesize({ lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好' }, cancelled.signal)).rejects.toThrow('cancelled')
    await service.select({ lineId, locale: 'zh-CN', takeId: null, expectedRevision: state.revision, replaceSelected: true })
    expect((await service.read()).ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
  })

  it('registers translated takes without overwriting source prose or another locale', async () => {
    const state = await snapshot()
    const plan = await createVoiceTakeEditPlan(state, { expectedRevision: state.revision, lineId, locale: 'ja-JP', speakerId: 'hero', displayText: 'こんにちは', candidate: { ...candidate, text: 'こんにちは' }, assetPath: 'audio/voice/ja.wav', voiceProfileRevision: hash, source: 'system' })
    expect(plan.ledger.lines[lineId]!.displayText).toBe('你好')
    expect(plan.ledger.lines[lineId]!.locales['zh-CN']).toEqual(state.ledger.lines[lineId]!.locales['zh-CN'])
    const selected = createVoiceTakeSelectionPlan({ ledger: plan.ledger, catalog: plan.catalog, revision: 'translated' }, { lineId, locale: 'ja-JP', takeId: plan.addedTakes[0]!.id, expectedRevision: 'translated' })
    expect(resolveVoiceTake(selected.ledger, { lineId, locale: 'ja-JP', assets: selected.catalog.assets }).warnings).toEqual([])
    expect(resolveVoiceTake(selected.ledger, { lineId, locale: 'zh-CN', assets: selected.catalog.assets }).warnings).toEqual([])
  })

  it('rejects candidate provenance substitutions, traversal and unapproved reference cloning', async () => {
    const state = await snapshot()
    const input = { expectedRevision: state.revision, lineId, locale: 'zh-CN', speakerId: 'hero', displayText: '你好', candidate, assetPath: 'voice.wav', voiceProfileRevision: hash, source: 'system' as const }
    await expect(createVoiceTakeEditPlan(state, { ...input, providerVoiceId: 'pretend' })).rejects.toThrow('actual provider')
    await expect(createVoiceTakeEditPlan(state, { ...input, assetPath: '../voice.wav' })).rejects.toThrow('project-relative')
    await expect(createVoiceTakeEditPlan(state, { ...input, candidate: { ...candidate, providerVoiceId: 'reference:ref:hash' } })).rejects.toThrow('cloned source')
    await expect(createVoiceTakeEditPlan(state, { ...input, candidate: { ...candidate, text: 'different' } })).rejects.toThrow('match')
    const empty = { ledger: createVoiceLedger(), catalog: structuredClone(catalog), revision: 'empty' }
    const plan = await createVoiceTakeEditPlan(empty, { ...input, expectedRevision: 'empty' })
    expect(plan.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
  })
})
