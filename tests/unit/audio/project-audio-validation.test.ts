import { webcrypto } from 'node:crypto'
import { audioFingerprint, prepareVoiceSpokenText } from '@advjs/audio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileProject } from '../../../packages/core/src/project'

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const takeId = 'take_019d137e-7abc-7000-8000-000000000001'
const assetId = 'audio_019d137e-7abc-7000-8000-000000000001'
const digest = 'a'.repeat(64)
beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

function files() {
  return {
    'adv.config.json': JSON.stringify({ id: 'audio-validation', root: 'adv' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Voice', characters: [{ id: 'hero', name: 'Hero' }] }),
    'adv/chapters/intro.adv.md': `@Hero\n你好。 {#${lineId}}`,
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'test', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [{ id: assetId, type: 'audio', kind: 'voice', path: 'audio/hello.wav', sha256: digest }] }),
    'adv/audio/voice-ledger.json': JSON.stringify({ schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '你好。', locales: { 'zh-CN': { selectedTake: takeId, takes: [{ id: takeId, assetId, sha256: digest, providerId: 'mock', voiceId: 'supplier-voice', model: 'mock-v1', voiceProfileRevision: digest, inputFingerprint: digest, spokenText: '你好。', source: 'system', createdAt: '2026-10-11T08:00:00.000Z' }] } } } } }),
  }
}

describe('project canonical audio validation', () => {
  it('uses current script text for the exact source locale while retaining translations and explicit spoken overrides', async () => {
    const input = files()
    const ledger = JSON.parse(input['adv/audio/voice-ledger.json'])
    const binding = ledger.lines[lineId].locales['zh-CN']
    binding.displayText = 'Earlier English'
    binding.takes[0].spokenText = 'Earlier English'
    const translated = JSON.parse(JSON.stringify(binding))
    translated.displayText = '日本語'
    translated.takes[0].id = 'take_019d137e-7abc-7000-8000-000000000002'
    translated.selectedTake = translated.takes[0].id
    translated.takes[0].spokenText = '日本語'
    const translatedAssetId = 'audio_019d137e-7abc-7000-8000-000000000002'
    translated.takes[0].assetId = translatedAssetId
    const catalog = JSON.parse(input['adv/assets.json'])
    catalog.assets.push({ ...catalog.assets[0], id: translatedAssetId, path: 'audio/hello-ja.wav' })
    input['adv/assets.json'] = JSON.stringify(catalog)
    ledger.lines[lineId].displayText = 'Current English'
    ledger.lines[lineId].locales = { 'en-US': binding, 'ja-JP': translated }
    input['adv/settings/game.json'] = JSON.stringify({ title: 'Voice', locale: 'en-US', characters: [{ id: 'hero', name: 'Hero' }] })
    input['adv/chapters/intro.adv.md'] = `@Hero\nCurrent English {#${lineId}}`
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    const stale = await compileProject({ files: input })
    expect(stale.diagnostics).toContainEqual(expect.objectContaining({ code: 'VOICE_STALE' }))
    expect(stale.diagnostics.filter(issue => issue.code === 'VOICE_STALE')).toHaveLength(1)
    binding.spokenText = 'Earlier English'
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    const explicit = await compileProject({ files: input })
    expect(explicit.diagnostics).toEqual([])
  })
  it('builds the same playable protocol from valid ledger and exact native assets', async () => {
    const result = await compileProject({ files: files() })
    expect(result.diagnostics).toEqual([])
    expect(result.project.program?.schemaVersion).toBe(2)
  })

  it('preserves an empty catalog only for explicit authoring and still rejects missing selected takes', async () => {
    const input = files()
    const catalog = JSON.parse(input['adv/assets.json'])
    catalog.assets = []
    input['adv/assets.json'] = JSON.stringify(catalog)
    const { 'adv/audio/voice-ledger.json': _ledger, ...withoutLedger } = input
    const strict = await compileProject({ files: withoutLedger })
    expect(strict.project.assets).toBeUndefined()
    expect(strict.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_INVALID_ASSET_MANIFEST' }))
    const authoring = await compileProject({ files: withoutLedger }, { allowEmptyAssetManifest: true })
    expect(authoring.project.assets?.assets).toEqual([])
    expect(authoring.diagnostics).toEqual([])
    const selectedWithoutAsset = await compileProject({ files: input }, { allowEmptyAssetManifest: true })
    expect(selectedWithoutAsset.project.assets?.assets).toEqual([])
    expect(selectedWithoutAsset.project.program).toBeUndefined()
    expect(selectedWithoutAsset.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_INVALID_SELECTED_TAKE' }))
  })

  it.each(['sha256', 'missing-assets'] as const)('blocks invalid selected-take %s before producing a playable Program', async (kind) => {
    const input = files()
    if (kind === 'sha256')
      input['adv/assets.json'] = input['adv/assets.json'].replace(digest, 'b'.repeat(64))
    else
      input['adv/assets.json'] = input['adv/assets.json'].replace('"assets":[{', '"assets":[],"unused":[{')
    const result = await compileProject({ files: input })
    expect(result.project.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_INVALID_SELECTED_TAKE', path: 'adv/audio/voice-ledger.json' }))
  })

  it('rejects invalid ledger rights and speaker binding', async () => {
    const input = files()
    input['adv/audio/voice-ledger.json'] = input['adv/audio/voice-ledger.json'].replace('"source":"system"', '"source":"cloned"')
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_INVALID_VOICE_LEDGER' }))
    input['adv/audio/voice-ledger.json'] = files()['adv/audio/voice-ledger.json'].replace('"speakerId":"hero"', '"speakerId":"narrator"')
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_VOICE_SPEAKER_MISMATCH' }))
  })

  it('requires selected cloned consent records to exist in the full project file graph', async () => {
    const input: Record<string, string> = files()
    const ledger = JSON.parse(input['adv/audio/voice-ledger.json']!)
    const take = ledger.lines[lineId].locales['zh-CN'].takes[0]
    take.source = 'cloned'
    take.rights = { license: 'Explicit permission', subject: 'Hero performer', consentRecord: 'docs/consent/hero.md' }
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    const missing = await compileProject({ files: input })
    expect(missing.project.program).toBeUndefined()
    expect(missing.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_VOICE_CONSENT_REQUIRED', path: 'adv/audio/voice-ledger.json', severity: 'error' }))
    input['docs/consent/hero.md'] = '# Recorded consent\nThe performer authorizes this project voice.'
    const valid = await compileProject({ files: input })
    expect(valid.project.program).toBeDefined()
    expect(valid.diagnostics).toEqual([])
    for (const path of ['docs//consent/hero.md', 'docs/./consent/hero.md', '.git/consent.md', 'node_modules/consent.md', 'docs\\consent\\hero.md']) {
      take.rights.consentRecord = path
      input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
      const invalid = await compileProject({ files: input })
      expect(invalid.project.program).toBeUndefined()
      expect(invalid.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_VOICE_CONSENT_REQUIRED' }))
    }
  })

  it('warns about changed prose while preserving auditable historical takes', async () => {
    const input = files()
    input['adv/chapters/intro.adv.md'] = `@Hero\n编辑后的台词。 {#${lineId}}`
    const result = await compileProject({ files: input })
    expect(result.project.program).toBeDefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'VOICE_STALE', severity: 'warning' }))
  })

  it('validates shared mixer files and registered semantic UI cues', async () => {
    for (const [mixer, code] of [[{ schemaVersion: 1, buses: { music: { gain: 2 } } }, 'ADV_AUDIO_INVALID_MIXER'], [{ schemaVersion: 1, ui: { confirm: assetId } }, 'ADV_AUDIO_INVALID_UI_ASSET']] as const) {
      const input = { ...files(), 'adv/audio/mixer.json': JSON.stringify(mixer) }
      const result = await compileProject({ files: input })
      expect(result.project.program).toBeUndefined()
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, path: 'adv/audio/mixer.json' }))
    }
  })

  it('marks changed pronunciation and voice profile stale without replacing immutable selected audio', async () => {
    const input: Record<string, string> = files()
    const profile = { intent: { speakingStyle: 'calm' }, locales: { 'zh-CN': { providers: { mock: { voiceId: 'supplier-voice', source: 'system', model: 'mock-v1' } } } } }
    const dictionary = { schemaVersion: 1 as const, revision: 1, replacements: { 你好: '您好' }, locales: {} }
    input['adv/settings/game.json'] = JSON.stringify({ title: 'Voice', characters: [{ id: 'hero', name: 'Hero', voiceProfile: profile }] })
    input['adv/audio/pronunciation.json'] = JSON.stringify(dictionary)
    const prepared = await prepareVoiceSpokenText('你好。', { locale: 'zh-CN', pronunciation: dictionary })
    const ledger = JSON.parse(input['adv/audio/voice-ledger.json']!)
    Object.assign(ledger.lines[lineId].locales['zh-CN'].takes[0], { spokenText: prepared.text, pronunciationRevision: prepared.pronunciationRevision, voiceProfileRevision: await audioFingerprint(profile) })
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    const current = await compileProject({ files: input })
    expect(current.diagnostics).toEqual([])
    input['adv/audio/pronunciation.json'] = JSON.stringify({ ...dictionary, revision: 2 })
    const changedDictionary = await compileProject({ files: input })
    expect(changedDictionary.project.program).toBeDefined()
    expect(changedDictionary.diagnostics).toContainEqual(expect.objectContaining({ code: 'VOICE_STALE', severity: 'warning' }))
    input['adv/audio/pronunciation.json'] = JSON.stringify(dictionary)
    input['adv/settings/game.json'] = input['adv/settings/game.json']!.replace('calm', 'bright')
    const changedProfile = await compileProject({ files: input })
    expect(changedProfile.project.program).toBeDefined()
    expect(changedProfile.diagnostics).toContainEqual(expect.objectContaining({ code: 'VOICE_STALE', severity: 'warning' }))
    expect(input['adv/audio/voice-ledger.json']).toBe(JSON.stringify(ledger))
  })

  it('validates project dictionaries even when there is no voice ledger yet', async () => {
    const { 'adv/audio/voice-ledger.json': _ledger, ...input } = files()
    const result = await compileProject({ files: { ...input, 'adv/audio/pronunciation.json': JSON.stringify({ schemaVersion: 1, revision: 1, replacements: { apiKey: '<secret>' }, locales: {} }) } })
    expect(result.project.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_INVALID_PRONUNCIATION', path: 'adv/audio/pronunciation.json', severity: 'error' }))
  })

  it('validates the project narrator profile without creating a character and warns when it changes', async () => {
    const input: Record<string, string> = files()
    const profile = { intent: { speakingStyle: 'calm' }, locales: { 'zh-CN': { providers: { mock: { voiceId: 'supplier-voice', source: 'system', model: 'mock-v1' } } } } }
    input['adv/chapters/intro.adv.md'] = `> 你好。 {#${lineId}}`
    input['adv/audio/voice-profiles.json'] = JSON.stringify({ schemaVersion: 1, revision: 1, narrator: profile })
    const ledger = JSON.parse(input['adv/audio/voice-ledger.json']!)
    ledger.lines[lineId].speakerId = 'narrator'
    ledger.lines[lineId].locales['zh-CN'].takes[0].voiceProfileRevision = await audioFingerprint(profile)
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    const current = await compileProject({ files: input })
    expect(current.diagnostics).toEqual([])
    expect(current.project.characters.some(character => character.id === 'narrator')).toBe(false)
    input['adv/audio/voice-profiles.json'] = input['adv/audio/voice-profiles.json']!.replace('calm', 'bright')
    const changed = await compileProject({ files: input })
    expect(changed.project.program).toBeDefined()
    expect(changed.diagnostics).toContainEqual(expect.objectContaining({ code: 'VOICE_STALE', severity: 'warning' }))
    input['adv/audio/voice-profiles.json'] = JSON.stringify({ schemaVersion: 1, revision: 1, narrator: { credentials: 'invalid' } })
    const invalid = await compileProject({ files: input })
    expect(invalid.project.program).toBeUndefined()
    expect(invalid.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_INVALID_VOICE_PROFILES', severity: 'error' }))
  })
})
