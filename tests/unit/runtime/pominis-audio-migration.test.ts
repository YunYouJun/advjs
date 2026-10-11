import type { PominisAIVSConfig } from '../../../plugins/plugin-pominis/src/types'
import { describe, expect, it } from 'vitest'
import { convertPominisAItoAdvConfig } from '../../../plugins/plugin-pominis/shared/config'

function external(theme: string): PominisAIVSConfig {
  return {
    characters: [{ id: 'hero', name: 'Hero' }],
    chapters: [{ id: 'intro', startNodeId: 'line', nodes: [{ id: 'line', dialogues: [{ speaker: 'Hero', text: 'Hello' }], bgmThemeId: theme, next: 'last' }, { id: 'last', dialogues: [] }] }],
  } as unknown as PominisAIVSConfig
}

describe('pominis audio import mapping', () => {
  it('blocks unresolved supplier themes and incorrect native purpose', () => {
    expect(() => convertPominisAItoAdvConfig({ config: external('rural') })).toThrow(/ADV_AUDIO_MIGRATION_UNRESOLVED/u)
    expect(() => convertPominisAItoAdvConfig({ config: external('rural'), audio: { assets: { rain: { kind: 'ambience', src: '/rain.ogg' } }, themes: { rural: 'rain' } } })).toThrow(/ADV_AUDIO_MIGRATION_UNRESOLVED/u)
  })

  it('preserves incoming addresses and explicitly inserts native audio before dialogue', () => {
    const input = external('rural')
    const game = convertPominisAItoAdvConfig({ config: input, audio: { assets: { 'bgm/day': { kind: 'bgm', src: '/day.ogg' } }, themes: { rural: 'bgm/day' } } })
    expect(game.audio?.assets).toEqual({ 'bgm/day': { kind: 'bgm', src: '/day.ogg' } })
    expect(game.chapters[0].startNodeId).toBe('line')
    expect(game.chapters[0].nodes.slice(0, 2)).toMatchObject([
      { id: 'line', type: 'audio', next: 'line.dialogues', operations: [{ type: 'bgm', action: 'set', asset: 'bgm/day' }] },
      { id: 'line.dialogues', type: 'dialogues', next: 'last', dialogues: [{ speaker: 'hero', text: 'Hello' }] },
    ])
    expect(JSON.stringify(game)).not.toContain('bgmThemeId')
    expect(input.chapters[0].nodes[0].bgmThemeId).toBe('rural')
  })

  it('maps explicit supplier silence to a clear operation without a media guess', () => {
    expect(convertPominisAItoAdvConfig({ config: external('silence') }).chapters[0].nodes[0]).toMatchObject({ type: 'audio', operations: [{ type: 'bgm', action: 'clear' }] })
  })
})
