import { describe, expect, it } from 'vitest'
import { createCharacterCatalog, parseCharacterCatalog } from '../src'

describe('character catalog', () => {
  it('parses and indexes character markdown', () => {
    const catalog = parseCharacterCatalog([
      {
        source: 'song-jiang.character.md',
        content: `---\nid: song-jiang\nname: 宋江\n---\n\n## 性格\n\n沉着重义。\n`,
      },
    ])

    expect(catalog.size).toBe(1)
    expect(catalog.require('song-jiang').personality).toBe('沉着重义。')
  })

  it('rejects duplicate ids', () => {
    expect(() => createCharacterCatalog([
      { id: 'same', name: '甲' },
      { id: 'same', name: '乙' },
    ])).toThrow('Duplicate character id')
  })

  it('rejects dangling relationships by default', () => {
    expect(() => createCharacterCatalog([
      {
        id: 'a',
        name: '甲',
        relationships: [{ targetId: 'b', type: '故交' }],
      },
    ])).toThrow('references missing character')
  })
})
