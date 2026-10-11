import { parseCharacterMd } from '@advjs/parser'
import { describe, expect, it } from 'vitest'
import { updateCharacterSource } from '../../../editor/core/app/utils/character-source'

describe('character workspace source', () => {
  it('preserves unknown YAML and custom body sections while editing descriptions and tachies', () => {
    const original = '---\nid: rain\nname: 雨\ncustom:\n  owner: author\n---\n\n作者序言。\n\n## 性格\n\n旧描述。\n\n## 额外线索\n\n不要删除。\n'
    const character = { ...parseCharacterMd(original), name: '雨夜', personality: '新描述。', background: '背景。', cv: 'Voice actor', visual: { version: 'v1', fixedTraits: ['Blue eyes'] }, avatars: { happy: { src: 'art/happy.webp' } }, tachies: { default: { src: './adv/assets/rain.png' } } }
    const written = updateCharacterSource('adv/characters/rain.character.md', original, character)
    expect(written).toContain('owner: author')
    expect(written).toContain('作者序言。')
    expect(written).toContain('## 额外线索\n\n不要删除。')
    expect(parseCharacterMd(written)).toMatchObject(character)
    expect(written).not.toContain('旧描述。')
  })
  it('persists exact-locale provider profiles and removes an explicitly cleared profile while retaining actor credits', () => {
    const original = '---\nid: hero\nname: Hero\ncv: Actor\ncustom: retained\n---\n\n## 线索\n\nRetain prose.\n'
    const voiceProfile = { intent: { speakingStyle: 'Quiet' }, locales: { 'zh-CN': { providers: { 'openai-tts': { voiceId: 'coral', model: 'gpt-4o-mini-tts', source: 'system' as const } } } } }
    const written = updateCharacterSource('adv/characters/hero.character.md', original, { ...parseCharacterMd(original), voiceProfile })
    expect(parseCharacterMd(written).voiceProfile).toEqual(voiceProfile)
    expect(written).toContain('custom: retained')
    expect(written).toContain('Retain prose.')
    const cleared = updateCharacterSource('adv/characters/hero.character.md', written, { ...parseCharacterMd(written), voiceProfile: undefined })
    expect(parseCharacterMd(cleared).voiceProfile).toBeUndefined()
    expect(parseCharacterMd(cleared).cv).toBe('Actor')
  })
})
