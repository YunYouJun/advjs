// @vitest-environment node
import type { AdvCharacter } from '@advjs/types'
import { describe, expect, it, vi } from 'vitest'
import { createCharacterCatalog } from '../../packages/character/src/catalog'
import { compileProject } from '../../packages/core/src/project'
import { exportCharacterForAI, exportCharacterVisualForAI, parseCharacterMd, stringifyCharacterMd } from '../../packages/parser/src/character'
import { CharacterVisualSchema } from '../../packages/parser/src/schemas/character'

const character: AdvCharacter = {
  id: 'artisan',
  name: 'Artisan',
  imagePrompt: 'A working artisan in natural light',
  visual: {
    version: 'workshop-v1',
    references: [{ path: 'art/reference sheet.png', description: 'Right column, front and profile' }],
    fixedTraits: ['Square face', 'Brown linen'],
    allowedChanges: ['Pose', 'Lighting'],
  },
  personality: 'Patient',
  attributes: { custom: { gift: { label: 'Craft', value: 'Engineering' } } },
}

describe('shared character visual identity', () => {
  it('roundtrips without losing narrative fields and is accepted by the character catalog', () => {
    const parsed = parseCharacterMd(stringifyCharacterMd(character))
    expect(parsed).toEqual(character)
    expect(createCharacterCatalog([parsed]).require('artisan').visual).toEqual(character.visual)
    expect(parseCharacterMd('---\nid: old\nname: Old\n---\n')).toEqual({ id: 'old', name: 'Old' })
  })

  it.each(['../secret.png', '/tmp/image.png', 'C:\\image.png', 'a/../b.png', 'https://host/a.png', 'a%2fb.png', 'a//b.png', './a.png'])('rejects nonportable reference %s', (path) => {
    expect(CharacterVisualSchema.safeParse({ version: 'v1', references: [{ path }] }).success).toBe(false)
  })

  it('rejects incomplete identities and unknown constraint keys', () => {
    expect(CharacterVisualSchema.safeParse({ version: ' ' }).success).toBe(false)
    expect(CharacterVisualSchema.safeParse({ version: 'v1', fixedTraits: [''] }).success).toBe(false)
    expect(CharacterVisualSchema.safeParse({ version: 'v1', fixedTrait: ['face'] }).success).toBe(false)
  })

  it('includes the same constraints and attachment instructions in both AI exports', () => {
    const brief = exportCharacterVisualForAI(character)
    expect(brief).toContain('Right column, front and profile')
    expect(brief).toContain('art/reference sheet.png')
    expect(brief).toContain('Brown linen')
    expect(brief).toContain('Lighting')
    expect(brief).toContain('实际附上参考图')
    expect(exportCharacterForAI(character)).toContain(brief)
    expect(exportCharacterForAI(character)).toContain('Patient')
    expect(exportCharacterVisualForAI({ id: 'legacy', name: 'Legacy' })).toBe('')
  })

  it('validates metadata without requiring binary images in the text source map', async () => {
    const path = 'story/characters/artisan.character.md'
    const files = {
      'adv.config.json': JSON.stringify({ format: 'adv-md', root: './story' }),
      'story/chapters/start.adv.md': 'A workshop.\n',
      [path]: stringifyCharacterMd(character),
    }
    const present = await compileProject({ files })
    expect(present.diagnostics.filter(item => item.code.includes('CHARACTER'))).toEqual([])
    expect(present.project.characters[0].visual).toEqual(character.visual)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const invalid = await compileProject({ files: { ...files, [path]: files[path].replace('version: workshop-v1', 'version: 123') } })
      expect(invalid.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_INVALID_CHARACTER_VISUAL', severity: 'error', path }))
    }
    finally {
      warning.mockRestore()
    }
  })
})
