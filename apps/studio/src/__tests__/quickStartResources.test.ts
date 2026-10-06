import { parseCharacterMd } from '@advjs/parser'
import { describe, expect, it, vi } from 'vitest'
import { quickStartTemplate } from '../utils/projectTemplate'

// Quick Start must use the same character filenames as discovery and CRUD.
describe('quick start authoring resources', () => {
  it('discovers both bundled characters without parser warnings', () => {
    const files = quickStartTemplate.files('Quick Start')
    const characterFiles = files.filter(file => file.path.startsWith('adv/characters/'))
    expect(characterFiles).toHaveLength(2)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const characters = characterFiles.map((file) => {
        expect(file.path).toMatch(/\.character\.md$/)
        const character = parseCharacterMd(file.content)
        expect(file.path).toBe(`adv/characters/${character.id}.character.md`)
        return character
      })
      expect(characters.map(character => character.name)).toEqual(['叶晴', '陆远'])
      expect(warn).not.toHaveBeenCalled()
    }
    finally {
      warn.mockRestore()
    }
  })
})
