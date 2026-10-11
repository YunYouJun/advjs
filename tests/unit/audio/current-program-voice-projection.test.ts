// @vitest-environment node
import type { VoiceLedger, VoiceTake } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { compileProject, createProjectGameConfig } from '../../../packages/core/src/project'

const ids = [1, 2, 3, 4].map(index => `line_019d137e-7abc-7000-8000-${String(index).padStart(12, '0')}`)
const hash = 'a'.repeat(64)
const musicId = 'audio_019d137e-7abc-7000-8000-000000000100'

function take(index: number, text: string): VoiceTake {
  const suffix = String(index).padStart(12, '0')
  return { id: `take_019d137e-7abc-7000-8000-${suffix}`, assetId: `audio_019d137e-7abc-7000-8000-${suffix}`, sha256: hash, providerId: 'fixture-tts', voiceId: 'fixture-voice', model: 'fixture-model', voiceProfileRevision: hash, inputFingerprint: hash, spokenText: text, source: 'system', createdAt: '2026-10-11T00:00:00.000Z' }
}

function project(format: 'flow' | 'adv-md') {
  const takes = [take(1, '你好。'), take(2, '历史对白。'), take(3, 'こんにちは。'), take(4, '古い台詞。'), take(5, 'Hello.'), take(6, '还没有声音。'), take(7, '旁白到达。'), take(8, '已删除对白。')]
  const ledger: VoiceLedger = { schemaVersion: 1, lines: {
    [ids[0]!]: { speakerId: 'hero', displayText: '你好。', locales: {
      'zh-CN': { selectedTake: takes[0]!.id, takes: [takes[0]!, takes[1]!] },
      'ja-JP': { displayText: 'こんにちは。', selectedTake: takes[2]!.id, takes: [takes[2]!, takes[3]!] },
      'en': { displayText: 'Hello.', selectedTake: null, takes: [takes[4]!] },
    } },
    [ids[1]!]: { speakerId: 'narrator', displayText: '旁白到达。', locales: { 'zh-CN': { selectedTake: takes[6]!.id, takes: [takes[6]!] } } },
    [ids[2]!]: { speakerId: 'hero', displayText: '已删除对白。', locales: { 'zh-CN': { selectedTake: takes[7]!.id, takes: [takes[7]!] } } },
    [ids[3]!]: { speakerId: 'narrator', displayText: '还没有声音。', locales: { 'zh-CN': { selectedTake: null, takes: [takes[5]!] } } },
  } }
  const path = `adv/chapters/intro.${format === 'flow' ? 'chapter.json' : 'adv.md'}`
  const files: Record<string, string> = {
    'adv.config.json': JSON.stringify({ id: 'current-voice', root: 'adv', format }),
    'adv/settings/game.json': JSON.stringify({ title: 'Current voice', locale: 'zh-CN', characters: [{ id: 'hero', name: 'Hero' }] }),
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'voice-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [
      ...takes.map((take, index) => ({ id: take.assetId, type: 'audio', kind: 'voice', path: `voice/${index}.wav`, sha256: hash })),
      { id: musicId, type: 'audio', kind: 'bgm', path: 'music.wav', sha256: hash },
    ] }),
    'adv/audio/voice-ledger.json': JSON.stringify(ledger),
    [path]: format === 'flow'
      ? JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', startNodeId: 'hello', nodes: [
          { id: 'hello', type: 'dialogues', dialogues: [{ speakerId: 'hero', text: '你好。', lineId: ids[0] }] },
          { id: 'arrived', type: 'narration', text: '旁白到达。', lineId: ids[1] },
          { id: 'unvoiced', type: 'narration', text: '还没有声音。', lineId: ids[3], next: null },
        ] })
      : `@Hero\n你好。 {#${ids[0]}}\n\n（旁白到达。） {#${ids[1]}}\n\n（还没有声音。） {#${ids[3]}}`,
  }
  return { files, ledger, takes, path }
}

describe('current compiled Program voice publication', () => {
  it.each(['flow', 'adv-md'] as const)('publishes current %s dialogue and narration selections across all locales without orphan audio or immutable history', async (format) => {
    const { files, ledger, takes } = project(format)
    const originalFiles = JSON.stringify(files)
    const result = await compileProject({ files })
    expect(result.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
    expect(result.project.program?.schemaVersion).toBe(2)
    const lines = Object.values(result.project.program!.chapters).flatMap(chapter => Object.values(chapter.nodes)).filter(node => node.kind === 'dialog' || node.kind === 'narration')
    expect(lines.map(node => node.data?.lineId)).toEqual([ids[0], ids[1], ids[3]])
    expect(lines.map(node => node.kind)).toEqual(['dialog', 'narration', 'narration'])
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_ORPHAN_VOICE_LINE', severity: 'warning' }))

    const runtime = createProjectGameConfig(result, files)
    expect(Object.keys(runtime.audio!.voiceLedger!.lines)).toEqual([ids[0], ids[1]])
    const dialogue = runtime.audio!.voiceLedger!.lines[ids[0]!]!
    expect(Object.keys(dialogue.locales)).toEqual(['zh-CN', 'ja-JP'])
    expect(dialogue.locales['zh-CN']!.takes).toEqual([takes[0]])
    expect(dialogue.locales['ja-JP']!.takes).toEqual([takes[2]])
    expect(runtime.audio!.voiceLedger!.lines[ids[1]!]!.speakerId).toBe('narrator')
    expect(Object.keys(runtime.audio!.assets).sort()).toEqual([takes[0]!.assetId, takes[2]!.assetId, takes[6]!.assetId, musicId].sort())
    expect(runtime.audio!.assets[takes[7]!.assetId]).toBeUndefined()
    expect(JSON.stringify(runtime.audio)).not.toContain('已删除对白。')
    expect(JSON.stringify(runtime.audio)).not.toContain('历史对白。')
    expect(JSON.stringify(files)).toBe(originalFiles)
    expect(JSON.parse(files['adv/audio/voice-ledger.json']!)).toEqual(ledger)
    expect(ledger.lines[ids[2]!]!.locales['zh-CN']!.selectedTake).toBe(takes[7]!.id)
  })

  it.each(['flow', 'adv-md'] as const)('does not publish historical voice if the %s source cannot produce a valid Program', async (format) => {
    const { files, takes, path } = project(format)
    files[path] = format === 'flow' ? '{invalid JSON' : '@MissingCharacter\n你好。'
    const result = await compileProject({ files })
    expect(result.project.program).toBeUndefined()
    expect(result.diagnostics.some(issue => issue.severity === 'error')).toBe(true)
    const runtime = createProjectGameConfig(result, files)
    expect(runtime.audio!.voiceLedger).toEqual({ schemaVersion: 1, lines: {} })
    expect(Object.keys(runtime.audio!.assets)).toEqual([musicId])
    expect(runtime.audio!.assets[takes[7]!.assetId]).toBeUndefined()
  })
})
