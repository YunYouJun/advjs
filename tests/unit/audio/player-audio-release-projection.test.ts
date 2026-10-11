import type { AdvConfig, AdvData, AdvGameConfig, VoiceLedger } from '@advjs/types'
import { resolveVoiceTake } from '@advjs/audio'
import { describe, expect, it } from 'vitest'
import { toPlayerConfig, toPlayerData } from '../../../packages/advjs/node/config/player'

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const takeId = 'take_019d137e-7abc-7000-8000-000000000001'
const assetId = 'audio_019d137e-7abc-7000-8000-000000000001'
const hash = 'a'.repeat(64)
const ledger: VoiceLedger = { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '你好。', locales: { 'zh-CN': { selectedTake: takeId, takes: [{ id: takeId, assetId, sha256: hash, spokenText: '你好。', providerId: 'fixture', voiceId: 'voice', model: 'model', inputFingerprint: hash, voiceProfileRevision: hash, source: 'cloned', rights: { subject: 'private-subject', consentRecord: 'rights/private-consent.md', license: 'permission' }, parameters: { instructions: 'private supplier prompt', preset: 'private-preset.json' }, createdAt: '2026-10-11T08:00:00.000Z' }] } } } } }
const game = { characters: [], audio: { assets: { [assetId]: { kind: 'voice', src: 'https://media.example/voice.webm', sha256: hash } }, voiceLedger: ledger } } as unknown as AdvGameConfig

describe('last player audio serialization boundary', () => {
  it('removes cloned voice consent and supplier parameters while preserving playable original identity', () => {
    const source = structuredClone(ledger)
    const config = toPlayerConfig({ gameConfig: game } as AdvConfig)
    const selected = config.gameConfig!.audio!.voiceLedger!
    expect(JSON.stringify(selected)).not.toContain('private-')
    expect(JSON.stringify(selected)).not.toContain('private supplier prompt')
    expect(resolveVoiceTake(selected, lineId, 'zh-CN', config.gameConfig!.audio!.assets).take).toMatchObject({ id: takeId, source: 'cloned', assetId, sha256: hash })
    expect(ledger).toEqual(source)
  })

  it('sanitizes both nested config and top-level game without mutating authoring data', () => {
    const source = { config: { gameConfig: game }, gameConfig: game } as AdvData
    const player = toPlayerData(source)
    for (const result of [player.config.gameConfig, player.gameConfig]) {
      const take = result!.audio!.voiceLedger!.lines[lineId]!.locales['zh-CN']!.takes[0]!
      expect(take).not.toHaveProperty('rights')
      expect(take).not.toHaveProperty('parameters')
      expect(take.id).toBe(takeId)
    }
    expect(source.gameConfig.audio!.voiceLedger!.lines[lineId]!.locales['zh-CN']!.takes[0]).toHaveProperty('rights.consentRecord', 'rights/private-consent.md')
  })
})
