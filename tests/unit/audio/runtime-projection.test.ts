// @vitest-environment node
import type { AdvAssetEntry, AdvData, VoiceLedger, VoiceTake } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { toPlayerConfig, toPlayerData } from '../../../packages/advjs/node/config/player'
import { isRuntimeAudioAsset, isRuntimeProjectAsset, projectRuntimeCharacter, projectRuntimeVoiceLedger, runtimeAudioAssetIds } from '../../../packages/audio/src/runtime-projection'
import { parseVoiceLedger, resolveVoiceTake } from '../../../packages/audio/src/voice-ledger'

const lineId = 'line_019b1ca0-0000-7000-8000-000000000001'
const unboundLineId = 'line_019b1ca0-0000-7000-8000-000000000002'
const hash = 'a'.repeat(64)

function take(sequence: number, text = '你好'): VoiceTake {
  const suffix = sequence.toString().padStart(12, '0')
  return { id: `take_019b1ca0-0000-7000-8000-${suffix}`, assetId: `audio_019b1ca0-0000-7000-8000-${suffix}`, sha256: hash, providerId: 'fake-tts', voiceId: 'voice', model: 'fake-model', voiceProfileRevision: hash, inputFingerprint: hash, spokenText: text, createdAt: '2026-10-11T00:00:00.000Z', source: 'system' }
}

function fixture(): VoiceLedger {
  const selected = take(1)
  const japanese = take(3, 'こんにちは')
  return {
    schemaVersion: 1,
    lines: {
      [lineId]: {
        speakerId: 'hero',
        displayText: '你好',
        locales: {
          'zh-CN': { selectedTake: selected.id, takes: [selected, take(2, '未选中的历史台词')] },
          'ja-JP': { selectedTake: japanese.id, displayText: 'こんにちは', takes: [japanese, take(4, '未選択')] },
          'en': { selectedTake: null, displayText: 'Hello', takes: [take(5, 'Hello')] },
        },
      },
      [unboundLineId]: { speakerId: 'narrator', displayText: '未配音旁白', locales: { 'zh-CN': { selectedTake: null, takes: [take(6, '未配音旁白')] } } },
    },
  }
}

describe('selected-only runtime audio projection', () => {
  it('keeps game character appearance while excluding author voice intent, bindings and consent paths', () => {
    const character = { id: 'hero', name: 'Hero', avatar: 'hero.png', voiceProfile: { intent: { speakingStyle: 'Private author instruction' }, locales: { en: { providers: { 'fake-tts': { voiceId: 'reference:private', model: 'fake-model', source: 'cloned' as const, rights: { license: 'Private license', subject: 'Performer', consentRecord: 'authoring/consent/hero.json' } } } } } } }
    expect(projectRuntimeCharacter(character)).toEqual({ id: 'hero', name: 'Hero', avatar: 'hero.png' })
    const data = { config: { gameConfig: { characters: [character] } }, gameConfig: { characters: [character] } } as unknown as AdvData
    expect(JSON.stringify(toPlayerData(data))).not.toContain('Private author instruction')
    expect(JSON.stringify(toPlayerConfig(data.config))).not.toContain('authoring/consent/hero.json')
    expect(character.voiceProfile.intent.speakingStyle).toBe('Private author instruction')
  })

  it('retains every selected locale but removes unbound lines, locales and historical takes', () => {
    const original = fixture()
    const projected = projectRuntimeVoiceLedger(original)
    expect(Object.keys(projected.lines)).toEqual([lineId])
    expect(Object.keys(projected.lines[lineId]!.locales)).toEqual(['zh-CN', 'ja-JP'])
    expect(projected.lines[lineId]!.locales['zh-CN']!.takes).toEqual([take(1)])
    expect(projected.lines[lineId]!.locales['ja-JP']!).toEqual({ selectedTake: take(3).id, displayText: 'こんにちは', takes: [take(3, 'こんにちは')] })
    expect(JSON.stringify(projected)).not.toContain('历史台词')
    expect(JSON.stringify(projected)).not.toContain('未配音旁白')
    expect(parseVoiceLedger(projected)).toEqual(projected)
    expect(original.lines[lineId]!.locales['zh-CN']!.takes).toHaveLength(2)
    projected.lines[lineId]!.locales['zh-CN']!.takes[0]!.model = 'different'
    expect(original.lines[lineId]!.locales['zh-CN']!.takes[0]!.model).toBe('fake-model')
  })

  it('makes only selected voice asset IDs available without locale fallback', () => {
    const projected = projectRuntimeVoiceLedger(fixture())
    const selected = runtimeAudioAssetIds(projected)
    expect([...selected]).toEqual([take(1).assetId, take(3).assetId])
    expect(runtimeAudioAssetIds()).toEqual(new Set())
    const assets: AdvAssetEntry[] = [...selected].map(id => ({ id, type: 'audio', kind: 'voice', sha256: hash }))
    expect(resolveVoiceTake(projected, { lineId, locale: 'ja-JP', assets }).take?.id).toBe(take(3).id)
    expect(resolveVoiceTake(projected, { lineId, locale: 'en', assets }).take).toBeUndefined()
  })

  it('retains playback kinds and non-audio build assets while rejecting reference and unselected voice audio', () => {
    const selected = runtimeAudioAssetIds(fixture())
    for (const kind of ['bgm', 'ambience', 'sfx', 'ui'])
      expect(isRuntimeAudioAsset({ id: kind, type: 'audio', kind }, selected)).toBe(true)
    expect(isRuntimeAudioAsset({ id: take(1).assetId, type: 'audio', kind: 'voice' }, selected)).toBe(true)
    expect(isRuntimeAudioAsset({ id: take(2).assetId, type: 'audio', kind: 'voice' }, selected)).toBe(false)
    expect(isRuntimeAudioAsset({ id: 'reference', type: 'audio', kind: 'reference' }, selected)).toBe(false)
    expect(isRuntimeAudioAsset({ id: 'unknown', type: 'audio', kind: 'audio' }, selected)).toBe(false)
    expect(isRuntimeAudioAsset({ id: 'image', type: 'image', kind: 'background' }, selected)).toBe(false)
    expect(isRuntimeProjectAsset({ id: 'image', type: 'image', kind: 'background' }, selected)).toBe(true)
    expect(isRuntimeProjectAsset({ id: 'reference', type: 'audio', kind: 'reference' }, selected)).toBe(false)
  })

  it('fails malformed selections instead of publishing missing or ambiguous takes', () => {
    const invalid = fixture()
    invalid.lines[lineId]!.locales['zh-CN']!.selectedTake = take(99).id
    expect(() => projectRuntimeVoiceLedger(invalid)).toThrow('missing')
    expect(() => runtimeAudioAssetIds(invalid)).toThrow('missing')
    expect(projectRuntimeVoiceLedger({ schemaVersion: 1, lines: {} })).toEqual({ schemaVersion: 1, lines: {} })
  })
})
