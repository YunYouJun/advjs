import { describe, expect, it } from 'vitest'
import { parseLocationMd, stringifyLocationMd } from '../utils/locationMd'

describe('parseLocationMd', () => {
  it('parses full frontmatter', () => {
    const md = `---
id: castle-hall
name: Castle Main Hall
type: indoor
description: A grand hall
tags:
  - main
linkedScenes:
  - scene-01
linkedCharacters:
  - aria
---
`
    const result = parseLocationMd(md)
    expect(result.id).toBe('castle-hall')
    expect(result.name).toBe('Castle Main Hall')
    expect(result.type).toBe('indoor')
    expect(result.description).toBe('A grand hall')
    expect(result.tags).toEqual(['main'])
    expect(result.linkedScenes).toEqual(['scene-01'])
    expect(result.linkedCharacters).toEqual(['aria'])
  })

  it('uses id as name when name is missing', () => {
    const md = `---
id: forest
---
`
    const result = parseLocationMd(md)
    expect(result.name).toBe('forest')
  })

  it('uses body as description when frontmatter description is missing', () => {
    const md = `---
id: garden
name: Rose Garden
---
A beautiful garden full of roses.`
    const result = parseLocationMd(md)
    expect(result.description).toBe('A beautiful garden full of roses.')
  })

  it('throws when id is missing', () => {
    const md = `---
name: No ID Location
---
`
    expect(() => parseLocationMd(md)).toThrow('id')
  })

  it('omits undefined fields', () => {
    const md = `---
id: simple
name: Simple
---
`
    const result = parseLocationMd(md)
    expect(result).not.toHaveProperty('tags')
    expect(result).not.toHaveProperty('linkedScenes')
    expect(result).not.toHaveProperty('type')
  })
})

describe('stringifyLocationMd', () => {
  it('serializes basic location', () => {
    const result = stringifyLocationMd({ id: 'cafe', name: 'Café' })
    expect(result).toContain('id: cafe')
    expect(result).toContain('name: Café')
    expect(result).toMatch(/^---\n/)
    expect(result).toMatch(/\n---\n$/)
  })

  it('omits empty arrays', () => {
    const result = stringifyLocationMd({ id: 'x', name: 'X', tags: [], linkedScenes: [] })
    expect(result).not.toContain('tags')
    expect(result).not.toContain('linkedScenes')
  })

  it('includes non-empty arrays', () => {
    const result = stringifyLocationMd({
      id: 'y',
      name: 'Y',
      tags: ['tag1'],
      linkedScenes: ['s1'],
    })
    expect(result).toContain('tags')
    expect(result).toContain('tag1')
    expect(result).toContain('linkedScenes')
    expect(result).toContain('s1')
  })

  it('round-trips correctly', () => {
    const original = {
      id: 'roundtrip',
      name: 'Roundtrip',
      type: 'outdoor' as const,
      tags: ['test'],
      linkedScenes: ['scene-a'],
      linkedCharacters: ['char-b'],
    }
    const md = stringifyLocationMd(original)
    const parsed = parseLocationMd(md)
    expect(parsed.id).toBe(original.id)
    expect(parsed.name).toBe(original.name)
    expect(parsed.type).toBe(original.type)
    expect(parsed.tags).toEqual(original.tags)
    expect(parsed.linkedScenes).toEqual(original.linkedScenes)
    expect(parsed.linkedCharacters).toEqual(original.linkedCharacters)
  })
})
