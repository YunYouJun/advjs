import { describe, expect, it } from 'vitest'
import { parseSceneMd, stringifySceneMd } from '../utils/sceneMd'

describe('parseSceneMd', () => {
  it('parses basic scene frontmatter', () => {
    const md = `---
id: school
name: 学校
description: 一所普通的高中
type: image
---
`
    const scene = parseSceneMd(md)
    expect(scene.id).toBe('school')
    expect(scene.name).toBe('学校')
    expect(scene.description).toBe('一所普通的高中')
    expect(scene.type).toBe('image')
  })

  it('falls back name to id when name missing', () => {
    const md = `---
id: park
---
`
    const scene = parseSceneMd(md)
    expect(scene.name).toBe('park')
  })

  it('throws on missing id', () => {
    const md = `---
name: no-id-scene
---
`
    expect(() => parseSceneMd(md)).toThrow('must have a string `id`')
  })

  it('uses body as description when frontmatter description missing', () => {
    const md = `---
id: forest
name: 森林
---
一片幽深的森林
`
    const scene = parseSceneMd(md)
    expect(scene.description).toBe('一片幽深的森林')
  })

  it('parses src and tags', () => {
    const md = `---
id: beach
name: Beach
src: images/beach.png
tags:
  - outdoor
  - summer
---
`
    const scene = parseSceneMd(md)
    expect(scene.src).toBe('images/beach.png')
    expect(scene.tags).toEqual(['outdoor', 'summer'])
  })

  it('strips undefined fields', () => {
    const md = `---
id: minimal
---
`
    const scene = parseSceneMd(md)
    expect(Object.keys(scene)).not.toContain('src')
    expect(Object.keys(scene)).not.toContain('imagePrompt')
  })
})

describe('stringifySceneMd', () => {
  it('produces valid frontmatter', () => {
    const output = stringifySceneMd({
      id: 'school',
      name: '学校',
      description: '一所高中',
      type: 'image',
    })
    expect(output).toContain('---')
    expect(output).toContain('id: school')
    expect(output).toContain('name: 学校')
  })

  it('includes tags array', () => {
    const output = stringifySceneMd({
      id: 'park',
      name: 'Park',
      tags: ['outdoor', 'day'],
    })
    expect(output).toContain('tags:')
    expect(output).toContain('outdoor')
  })

  it('omits empty/undefined fields', () => {
    const output = stringifySceneMd({
      id: 'minimal',
      name: 'Min',
    })
    expect(output).not.toContain('src:')
    expect(output).not.toContain('imagePrompt:')
    expect(output).not.toContain('tags:')
  })

  it('round-trips basic scene data', () => {
    const original = {
      id: 'cafe',
      name: 'Cafe',
      description: 'A cozy cafe',
      type: 'image' as const,
      src: 'images/cafe.png',
    }
    const md = stringifySceneMd(original)
    const parsed = parseSceneMd(md)
    expect(parsed.id).toBe(original.id)
    expect(parsed.name).toBe(original.name)
    expect(parsed.type).toBe(original.type)
    expect(parsed.src).toBe(original.src)
  })
})
