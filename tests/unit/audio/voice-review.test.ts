// @vitest-environment node
import type { AudioPronunciationDictionary, CharacterVoiceProfile, VoiceAuthoringSnapshot, VoiceTake } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { audioFingerprint, prepareVoiceSpokenText, resolveVoiceReviewRows, voiceReviewContextFromProgram } from '../../../packages/audio/src'
import { compileProject } from '../../../packages/core/src/project'

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const orphanId = 'line_019d137e-7abc-7000-8000-000000000002'
const hash = 'a'.repeat(64)
const dictionary: AudioPronunciationDictionary = { schemaVersion: 1, revision: 1, replacements: { ADV: '冒险' }, locales: {} }
const profile: CharacterVoiceProfile = { intent: { speakingStyle: 'Calm' }, locales: { 'zh-CN': { providers: { fixture: { voiceId: 'hero', source: 'system', model: 'model' } } } } }

async function fixture(format: 'flow' | 'adv-md' = 'flow', override?: string) {
  const prepared = await prepareVoiceSpokenText('ADV 到达。', { locale: 'zh-CN', pronunciation: dictionary, override })
  const revision = await audioFingerprint(profile)
  function take(index: number, spokenText: string): VoiceTake {
    const suffix = String(index).padStart(12, '0')
    return { id: `take_019d137e-7abc-7000-8000-${suffix}`, assetId: `audio_019d137e-7abc-7000-8000-${suffix}`, sha256: hash, providerId: 'fixture', voiceId: 'hero', model: 'model', voiceProfileRevision: revision, inputFingerprint: hash, spokenText, ...(prepared.pronunciationRevision ? { pronunciationRevision: prepared.pronunciationRevision } : {}), source: 'system', createdAt: '2026-10-12T00:00:00.000Z' }
  }
  const takes = [take(1, prepared.text), take(2, '历史台词。'), take(3, 'Arrival.'), take(4, '删除的台词。')]
  const snapshot: VoiceAuthoringSnapshot = {
    revision: hash,
    pronunciation: structuredClone(dictionary),
    ledger: { schemaVersion: 1, lines: {
      [lineId]: { speakerId: 'hero', displayText: 'ADV 到达。', locales: {
        'zh-CN': { displayText: 'ADV 到达。', ...(override === undefined ? {} : { spokenText: override }), selectedTake: takes[0]!.id, takes: takes.slice(0, 2) },
        'en': { displayText: 'Arrival.', selectedTake: takes[2]!.id, takes: [takes[2]!] },
      } },
      [orphanId]: { speakerId: 'hero', displayText: '删除的台词。', locales: { 'zh-CN': { selectedTake: takes[3]!.id, takes: [takes[3]!] } } },
    } },
    catalog: { schemaVersion: 2, id: 'review', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: takes.map(take => ({ id: take.assetId, type: 'audio', kind: 'voice', sha256: hash, path: `${take.assetId}.wav` })) },
  }
  const path = `adv/chapters/intro.${format === 'flow' ? 'chapter.json' : 'adv.md'}`
  const files = {
    'adv.config.json': JSON.stringify({ id: 'review', format, root: 'adv' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Review', locale: 'zh-CN', characters: [{ id: 'hero', name: 'Hero', voiceProfile: profile }] }),
    'adv/assets.json': JSON.stringify(snapshot.catalog),
    'adv/audio/voice-ledger.json': JSON.stringify(snapshot.ledger),
    'adv/audio/pronunciation.json': JSON.stringify(snapshot.pronunciation),
    [path]: format === 'flow' ? JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [{ id: 'hello', dialogues: [{ speakerId: 'hero', text: 'ADV 到达。', lineId }] }] }) : `@Hero\nADV 到达。 {#${lineId}}`,
  }
  const compiled = await compileProject({ files })
  expect(compiled.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
  const context = voiceReviewContextFromProgram(compiled.project.program, Object.fromEntries(compiled.project.characters.map(character => [character.id, character.voiceProfile])), String(compiled.project.game.locale))
  return { snapshot, context, files, path }
}

describe('shared author voice review', () => {
  it.each(['flow', 'adv-md'] as const)('reviews %s dictionary-resolved audio and every immutable history entry without changing selection', async (format) => {
    const { snapshot, context } = await fixture(format)
    const original = JSON.stringify(snapshot)
    const rows = await resolveVoiceReviewRows(snapshot, context)
    expect(rows[0]).toMatchObject({ displayText: 'ADV 到达。', spokenText: '冒险 到达。', takes: [{ selected: true, stale: false, unavailable: false }, { selected: false, stale: true, unavailable: false }] })
    expect(rows[1]).toMatchObject({ displayText: 'Arrival.', spokenText: 'Arrival.', takes: [{ stale: false }] })
    expect(rows[2]!.takes[0]).toMatchObject({ selected: true, stale: true })
    expect(JSON.stringify(snapshot)).toBe(original)
  })

  it('detects dictionary identity and profile changes even when the resolved prose stays identical', async () => {
    const { snapshot, context } = await fixture()
    snapshot.pronunciation!.revision++
    expect((await resolveVoiceReviewRows(snapshot, context))[0]!.takes[0]!.stale).toBe(true)
    snapshot.pronunciation!.revision--
    context.profiles = { hero: { ...profile, intent: { speakingStyle: 'Energetic' } } }
    expect((await resolveVoiceReviewRows(snapshot, context))[0]!.takes[0]!.stale).toBe(true)
  })

  it('requires reverification after a character or narrator profile is removed while retaining playable history', async () => {
    const { snapshot, context } = await fixture()
    context.profiles = { hero: undefined }
    expect((await resolveVoiceReviewRows(snapshot, context))[0]!.takes[0]).toMatchObject({ stale: true, unavailable: false })

    snapshot.ledger.lines[lineId]!.speakerId = 'narrator'
    snapshot.narratorProfile = profile
    context.lines = [{ lineId, speakerId: 'narrator', displayText: 'ADV 到达。' }]
    context.profiles = {}
    expect((await resolveVoiceReviewRows(snapshot, context))[0]!.takes[0]!.stale).toBe(false)
    delete snapshot.narratorProfile
    expect((await resolveVoiceReviewRows(snapshot, context))[0]!.takes[0]).toMatchObject({ stale: true, unavailable: false })
  })

  it('keeps explicit spoken overrides independent of dictionary changes and uses current source prose only for its exact locale', async () => {
    const { snapshot, context, files, path } = await fixture('flow', '我的显式读法。')
    snapshot.pronunciation!.revision++
    expect((await resolveVoiceReviewRows(snapshot, context))[0]!.takes[0]!.stale).toBe(false)
    delete snapshot.ledger.lines[lineId]!.locales['zh-CN']!.spokenText
    files[path] = files[path]!.replace('ADV 到达。', '源语言已更新。')
    const compiled = await compileProject({ files })
    const current = voiceReviewContextFromProgram(compiled.project.program, context.profiles, 'zh-CN')
    const rows = await resolveVoiceReviewRows(snapshot, current)
    expect(rows[0]).toMatchObject({ displayText: '源语言已更新。', spokenText: '源语言已更新。', takes: [{ stale: true }, { stale: true }] })
    expect(rows[1]).toMatchObject({ displayText: 'Arrival.', spokenText: 'Arrival.' })
  })

  it('evaluates narrator profiles, unavailable masters and unresolved variables without making audio or mutating the ledger', async () => {
    const { snapshot } = await fixture()
    snapshot.ledger.lines[lineId]!.speakerId = 'narrator'
    snapshot.narratorProfile = { ...profile, intent: { speakingStyle: 'New narration' } }
    const context = { lines: [{ lineId, speakerId: 'narrator', displayText: '{{runtime}}' }] }
    snapshot.catalog.assets[1]!.sha256 = 'b'.repeat(64)
    const rows = await resolveVoiceReviewRows(snapshot, context)
    expect(rows[0]!.takes[0]).toMatchObject({ stale: true, unavailable: false })
    expect(rows[0]!.takes[1]).toMatchObject({ stale: true, unavailable: true })
    const missingProgram = voiceReviewContextFromProgram(undefined, {})
    expect((await resolveVoiceReviewRows(snapshot, missingProgram)).every(row => row.takes.every(take => take.stale))).toBe(true)
  })
})
