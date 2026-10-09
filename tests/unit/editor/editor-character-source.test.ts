import { parseCharacterMd } from '@advjs/parser'
import { describe, expect, it } from 'vitest'
import { updateCharacterSource } from '../../../editor/core/app/utils/character-source'

describe('character workspace source', () => {
  it('preserves unknown YAML and custom body sections while editing descriptions and tachies', () => {
    const original = '---\nid: rain\nname: 雨\ncustom:\n  owner: author\n---\n\n作者序言。\n\n## 性格\n\n旧描述。\n\n## 额外线索\n\n不要删除。\n'
    const character = { ...parseCharacterMd(original), name: '雨夜', personality: '新描述。', background: '背景。', tachies: { default: { src: './adv/assets/rain.png' } } }
    const written = updateCharacterSource('adv/characters/rain.character.md', original, character)
    expect(written).toContain('owner: author')
    expect(written).toContain('作者序言。')
    expect(written).toContain('## 额外线索\n\n不要删除。')
    expect(parseCharacterMd(written)).toMatchObject(character)
    expect(written).not.toContain('旧描述。')
  })
})
