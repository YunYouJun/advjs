import type { AdvChapter, RuntimeProgram, RuntimeSnapshot } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { compileFlowProgram, compileMarkdownProgram } from '../../../packages/core/src/compiler'
import { createAdvRuntime } from '../../../packages/core/src/runtime'

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const nextLineId = 'line_019d137e-7abc-7000-8000-000000000002'

function source(lines: string[]): string {
  return ['```yaml', ...lines, '```'].join('\n')
}

async function compile(content: string, audio?: Record<string, string>) {
  return compileMarkdownProgram({ id: 'audio', chapters: [{ id: 'intro', sourcePath: 'adv/chapters/intro.adv.md', content }], ...(audio ? { resources: { audio } } : {}) })
}

describe('canonical runtime audio protocol', () => {
  it('mixes persistent music and bounded ambience with transient SFX and current dialogue', async () => {
    const result = await compile([
      source([
        '- type: bgm',
        '  action: set',
        '  asset: bgm.night',
        '  gain: 0.7',
        '  fade:',
        '    in: 500',
        '    out: 250',
        '- type: ambience',
        '  action: set',
        '  slot: weather',
        '  asset: ambience.rain',
        '- type: ambience',
        '  action: set',
        '  slot: crowd',
        '  asset: ambience.crowd',
        '- type: sfx',
        '  action: play',
        '  asset: sfx.door',
        '  group: environment',
        '  priority: 2',
      ]),
      `@hero\n到家了。 {#${lineId}}`,
      source(['- type: ambience', '  action: clear', '  slot: weather', '  fade:', '    out: 300']),
      `> 夜色沉下来。 {#${nextLineId}}`,
    ].join('\n\n'), { 'bgm.night': 'bgm', 'ambience.rain': 'ambience', 'ambience.crowd': 'ambience', 'sfx.door': 'sfx' })
    expect(result.diagnostics).toEqual([])
    const runtime = createAdvRuntime({ program: result.program! })
    const first = await runtime.start()
    expect(first.state.stage.audio).toEqual({
      bgm: { assetId: 'bgm.night', loop: true, gain: 0.7, fadeInMs: 500, fadeOutMs: 250 },
      ambience: { weather: { assetId: 'ambience.rain', loop: true }, crowd: { assetId: 'ambience.crowd', loop: true } },
    })
    expect(first.effects).toContainEqual({ type: 'audio.sfx', payload: { assetId: 'sfx.door', group: 'environment', priority: 2 } })
    expect(first.effects).toContainEqual({ type: 'dialogue.voice', payload: { lineId, speakerId: 'hero', text: '到家了。' } })
    expect(JSON.stringify(first.state)).not.toContain('sfx.door')

    const snapshot = runtime.snapshot()
    const next = await runtime.next()
    expect(next.state.stage.audio.ambience).toEqual({ crowd: { assetId: 'ambience.crowd', loop: true } })
    expect(next.effects).toContainEqual({ type: 'dialogue.voice', payload: { lineId: nextLineId, speakerId: 'narrator', text: '夜色沉下来。' } })
    expect(next.effects).toContainEqual(expect.objectContaining({ type: 'audio.state', payload: expect.objectContaining({ fade: { out: 300 }, slot: 'weather' }) }))
    for (const history of [runtime.back(), runtime.forward(), runtime.restore(snapshot)]) {
      expect(history.effects.map(effect => effect.type)).toContain('audio.state')
      expect(history.effects.map(effect => effect.type)).not.toContain('audio.sfx')
      expect(history.effects.map(effect => effect.type)).not.toContain('dialogue.voice')
    }
    expect(JSON.stringify(snapshot)).not.toMatch(/sfx.door|selectedTake|voiceProgress/u)
    expect(snapshot.schemaVersion).toBe(2)
  })

  it.each([
    [['type: bgm', 'name: library-track'], 'ADV_AUDIO_LEGACY_OPERATION'],
    [['type: bgm', 'action: play', 'asset: bgm.night'], 'ADV_AUDIO_INVALID_ACTION'],
    [['type: bgm', 'action: set', 'asset: https://provider.test/file.wav'], 'ADV_AUDIO_INVALID_ASSET'],
    [['type: ambience', 'action: set', 'asset: ambience.rain', 'slot: unbounded'], 'ADV_AUDIO_INVALID_SLOT'],
    [['type: bgm', 'action: set', 'asset: bgm.night', 'fade:', '  in: -1'], 'ADV_AUDIO_INVALID_FADE'],
    [['type: bgm', 'action: set', 'asset: bgm.night', 'gain: 1.1'], 'ADV_AUDIO_INVALID_GAIN'],
    [['type: sfx', 'action: play', 'asset: sfx.door', 'loop: true'], 'ADV_AUDIO_INVALID_LOOP'],
    [['type: sfx', 'action: play', 'asset: sfx.door', 'fade:', '  out: 10'], 'ADV_AUDIO_INVALID_FADE'],
    [['type: sfx', 'action: play', 'asset: sfx.door', 'priority: high'], 'ADV_AUDIO_INVALID_PRIORITY'],
    [['type: bgm', 'action: clear', 'asset: bgm.night'], 'ADV_AUDIO_INVALID_ASSET'],
    [['type: bgm', 'action: clear', 'fade:', '  in: 10'], 'ADV_AUDIO_INVALID_FADE'],
    [['type: voice', 'action: play', 'asset: voice.hello'], 'ADV_AUDIO_UNSUPPORTED_OPERATION'],
    [['type: ui', 'action: play', 'asset: ui.click'], 'ADV_AUDIO_UNSUPPORTED_OPERATION'],
  ])('rejects invalid audio declarations: %s', async (lines, code) => {
    const result = await compile(source(lines))
    expect(result.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, source: expect.objectContaining({ line: 1, file: 'adv/chapters/intro.adv.md' }) }))
  })

  it('requires the correct native resource purpose and rejects missing assets', async () => {
    for (const [audio, code] of [[{ 'bgm.night': 'reference' }, 'ADV_AUDIO_ASSET_KIND_MISMATCH'], [{}, 'ADV_AUDIO_UNKNOWN_ASSET']] as const) {
      const result = await compile(source(['type: bgm', 'action: set', 'asset: bgm.night']), audio)
      expect(result.program).toBeUndefined()
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }))
    }
  })

  it('preserves line IDs through reordering and reports project-wide duplicates', async () => {
    const reordered = await compile(`@hero\n第二句。 {#${nextLineId}}\n\n@hero\n已编辑的第一句。 {#${lineId}}`)
    expect(Object.values(reordered.program!.chapters.intro.nodes).filter(node => node.kind === 'dialog').map(node => node.data?.lineId)).toEqual([nextLineId, lineId])
    const duplicate = await compileMarkdownProgram({
      id: 'duplicates',
      chapters: [{ id: 'first', content: `@hero\n一句。 {#${lineId}}` }, { id: 'second', sourcePath: 'second.adv.md', content: `> 旁白。 {#${lineId}}` }],
    })
    expect(duplicate.program).toBeUndefined()
    expect(duplicate.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_RUNTIME_DUPLICATE_LINE_ID', source: { file: 'second.adv.md', line: 1, column: 1 } }))
  })

  it('maps character display names to stable speaker IDs', async () => {
    const result = await compileMarkdownProgram({ id: 'speaker', resources: { speakers: { 三叶: 'mitsuha' } }, chapters: [{ id: 'intro', content: `@三叶\n你好。 {#${lineId}}` }] })
    expect(Object.values(result.program!.chapters.intro.nodes)[0].data).toMatchObject({ character: '三叶', speakerId: 'mitsuha', lineId })
  })

  it('uses the same operation and line contract in serialized Flow', async () => {
    const chapters: AdvChapter[] = [{ id: 'intro', title: 'Flow', nodes: [
      { id: 'audio', type: 'audio', operations: [{ type: 'bgm', action: 'set', asset: 'bgm.night' }, { type: 'ambience', action: 'set', asset: 'ambience.rain', slot: 'weather' }] },
      { id: 'line', type: 'dialogues', dialogues: [{ lineId, speakerId: 'hero', text: '你好。' }, { lineId: nextLineId, text: '旁白。' }] },
    ] }]
    const result = await compileFlowProgram({ id: 'flow-audio', chapters })
    expect(result.diagnostics).toEqual([])
    const runtime = createAdvRuntime({ program: result.program! })
    expect((await runtime.start()).effects).toContainEqual({ type: 'dialogue.voice', payload: { lineId, speakerId: 'hero', text: '你好。' } })
    expect((await runtime.next()).effects).toContainEqual({ type: 'dialogue.voice', payload: { lineId: nextLineId, speakerId: 'narrator', text: '旁白。' } })
    chapters[0].nodes[1] = { id: 'line', type: 'dialogues', dialogues: [{ lineId: 'line_invalid', text: 'Invalid' }] }
    expect((await compileFlowProgram({ id: 'bad-flow', chapters })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_RUNTIME_INVALID_LINE_ID' }))
  })

  it('rejects pre-migration programs and snapshots and transient snapshot fields', async () => {
    const result = await compile('@hero\n你好。')
    const runtime = createAdvRuntime({ program: result.program! })
    await runtime.start()
    const snapshot = runtime.snapshot()
    expect(() => createAdvRuntime({ program: { ...result.program!, schemaVersion: 1 } as unknown as RuntimeProgram })).toThrow(/UNSUPPORTED_PROGRAM/u)
    expect(() => runtime.restore({ ...snapshot, schemaVersion: 1 } as unknown as RuntimeSnapshot)).toThrow(/unsupported schema/u)
    const extra = structuredClone(snapshot) as unknown as { state: { stage: { audio: Record<string, unknown> } } }
    extra.state.stage.audio.voiceProgress = 20
    expect(() => runtime.restore(extra as unknown as RuntimeSnapshot)).toThrow(/persistent BGM and ambience only/u)
  })
})
