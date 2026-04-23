import { describe, expect, it } from 'vitest'
import {
  getFieldsForPath,
  isLineInFrontmatter,
  resolveFrontmatterPath,
} from '../utils/characterFrontmatterCompletion'

const SAMPLE = `---
id: alice
name: Alice
attributes:
  template: galgame
  profile:
    age: 17
    personalityTags:
      - 温柔
  galgame:
    bloodType: AB
    likes:
      - 红茶
  rpg:
    stats:
      str: 14
  ai:
    promptInject: true
---

## 外貌

银发红眸。
`

describe('isLineInFrontmatter', () => {
  const lines = SAMPLE.split('\n')

  it('returns false for line 1 (the opening delimiter itself)', () => {
    expect(isLineInFrontmatter(lines, 1)).toBe(false)
  })

  it('returns true for a line inside the frontmatter', () => {
    // `attributes:` line
    expect(isLineInFrontmatter(lines, 4)).toBe(true)
    // `profile:` line
    expect(isLineInFrontmatter(lines, 6)).toBe(true)
  })

  it('returns false for lines after the closing delimiter', () => {
    // Body ## 外貌 section
    const bodyLineIdx = lines.findIndex(l => l.startsWith('## '))
    expect(isLineInFrontmatter(lines, bodyLineIdx + 1)).toBe(false)
  })

  it('returns false when there is no opening delimiter', () => {
    expect(isLineInFrontmatter(['no frontmatter', 'at all'], 1)).toBe(false)
    expect(isLineInFrontmatter(['no frontmatter', 'at all'], 2)).toBe(false)
  })

  it('allows typing inside an in-progress frontmatter without closing delim', () => {
    const inProgress = ['---', 'id: x', 'name: Y']
    expect(isLineInFrontmatter(inProgress, 2)).toBe(true)
    expect(isLineInFrontmatter(inProgress, 3)).toBe(true)
  })
})

describe('resolveFrontmatterPath', () => {
  const lines = SAMPLE.split('\n')

  it('resolves a top-level position to null (no ancestor)', () => {
    // Cursor on line 2 (`id: alice`), indent 0
    expect(resolveFrontmatterPath(lines, 2, 0)).toBeNull()
  })

  it('resolves inside `attributes:` (indent 2) to "attributes"', () => {
    // Line `  template: galgame` is at indent 2, ancestor is `attributes:`
    // → resolve at line 5 with cursorIndent 2
    expect(resolveFrontmatterPath(lines, 5, 2)).toBe('attributes')
  })

  it('resolves inside `attributes.profile` (indent 4) correctly', () => {
    // `    age: 17` line, cursor at indent 4
    const lineIdx = lines.findIndex(l => l.includes('age: 17'))
    expect(resolveFrontmatterPath(lines, lineIdx + 1, 4)).toBe('attributes.profile')
  })

  it('resolves inside `attributes.galgame` correctly', () => {
    // `    bloodType: AB` line
    const lineIdx = lines.findIndex(l => l.includes('bloodType'))
    expect(resolveFrontmatterPath(lines, lineIdx + 1, 4)).toBe('attributes.galgame')
  })

  it('resolves deeply nested `attributes.rpg.stats`', () => {
    // `      str: 14` line at indent 6
    const lineIdx = lines.findIndex(l => l.includes('str: 14'))
    expect(resolveFrontmatterPath(lines, lineIdx + 1, 6)).toBe('attributes.rpg.stats')
  })

  it('returns null when not inside attributes.*', () => {
    // A totally unrelated top-level key
    const other = ['---', 'aliases:', '  - Alice', '---'].join('\n').split('\n')
    expect(resolveFrontmatterPath(other, 3, 2)).toBeNull()
  })
})

describe('getFieldsForPath', () => {
  it('returns root attributes list', () => {
    const fields = getFieldsForPath('attributes')
    expect(fields).not.toBeNull()
    expect(fields!.map(f => f.key)).toContain('template')
    expect(fields!.map(f => f.key)).toContain('profile')
    expect(fields!.map(f => f.key)).toContain('rpg')
  })

  it('returns profile fields', () => {
    const fields = getFieldsForPath('attributes.profile')
    expect(fields!.map(f => f.key)).toEqual([
      'age',
      'gender',
      'occupation',
      'personalityTags',
      'appearanceSummary',
    ])
  })

  it('returns galgame fields', () => {
    const fields = getFieldsForPath('attributes.galgame')
    expect(fields!.map(f => f.key)).toContain('bloodType')
    expect(fields!.map(f => f.key)).toContain('affinityInitial')
  })

  it('returns rpg.stats six stats', () => {
    const fields = getFieldsForPath('attributes.rpg.stats')
    expect(fields!.map(f => f.key)).toEqual(['str', 'dex', 'int', 'con', 'wis', 'cha'])
  })

  it('returns null for unknown paths', () => {
    expect(getFieldsForPath('attributes.unknown')).toBeNull()
    expect(getFieldsForPath('unrelated.path')).toBeNull()
  })

  it('exposes enum values on template', () => {
    const fields = getFieldsForPath('attributes')!
    const template = fields.find(f => f.key === 'template')
    expect(template?.enumValues).toEqual(['universal', 'galgame', 'rpg'])
  })
})
