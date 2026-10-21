import type { AdvCharacter } from '@advjs/types'
import {
  parseAudioMd,
  parseChapterMd,
  parseCharacterMd,
  parseLocationMd,
  parseSceneMd,
  stringifyAudioMd,
  stringifyCharacterMd,
  stringifyLocationMd,
  stringifySceneMd,
  updateChapterMd,
} from '@advjs/parser'
import { describe, expect, it } from 'vitest'

const SCENE = `---
id: cafe
# keep this comment while nothing changes
name: Café
lighting: warm
type: image
assetId: bg.cafe
extra:
  mood: calm
---

A cozy café in Shibuya.
`

describe('content serializers with source', () => {
  it('returns an unchanged scene byte for byte', () => {
    expect(stringifySceneMd(parseSceneMd(SCENE), { source: SCENE })).toBe(SCENE)
  })

  it('keeps unknown scene keys, their order, and the body text', () => {
    const scene = { ...parseSceneMd(SCENE), name: 'Café Night', tags: ['night'] }
    const output = stringifySceneMd(scene, { source: SCENE })

    expect(output).toBe(`---
id: cafe
name: Café Night
lighting: warm
type: image
assetId: bg.cafe
extra:
  mood: calm
tags:
  - night
---

A cozy café in Shibuya.
`)
    expect(parseSceneMd(output)).toEqual({ ...scene, description: 'A cozy café in Shibuya.' })
  })

  it('writes a body-sourced description back to the body', () => {
    const output = stringifySceneMd({ ...parseSceneMd(SCENE), description: 'Closed for the night.' }, { source: SCENE })
    expect(output).toContain('lighting: warm')
    expect(output).not.toContain('description:')
    expect(output.endsWith('---\n\nClosed for the night.\n')).toBe(true)
  })

  it('does not materialize defaults the source left implicit', () => {
    const source = '---\nid: park\ncustom: 1\n---\n'
    const scene = parseSceneMd(source)
    expect(scene.name).toBe('park')
    expect(scene.type).toBe('image')
    expect(stringifySceneMd({ ...scene, imagePrompt: 'green' }, { source })).toBe('---\nid: park\ncustom: 1\nimagePrompt: green\n---\n')
  })

  it('removes cleared location fields and keeps the rest', () => {
    const source = `---
id: school
name: School
linkedScenes:
  - hall
  - gym
mapPin: [3, 4]
---
`
    const output = stringifyLocationMd({ ...parseLocationMd(source), linkedScenes: [] }, { source })
    expect(output).toBe('---\nid: school\nname: School\nmapPin:\n  - 3\n  - 4\n---\n')
  })

  it('keeps unknown audio keys', () => {
    const source = '---\nname: Theme\nloudness: -14\nsrc: theme.m4a\n---\n'
    const output = stringifyAudioMd({ ...parseAudioMd(source), duration: 20 }, { source })
    expect(output).toBe('---\nname: Theme\nloudness: -14\nsrc: theme.m4a\nduration: 20\n---\n')
  })

  it('falls back to a fresh document when the source is not this content type', () => {
    const fresh = stringifySceneMd({ id: 'new', name: 'New' })
    expect(stringifySceneMd({ id: 'new', name: 'New' }, { source: 'no frontmatter' })).toBe(fresh)
    expect(stringifySceneMd({ id: 'new', name: 'New' }, { source: '---\nname: missing id\n---\n' })).toBe(fresh)
  })
})

const CHARACTER = `---
id: xiaoyun
name: 小云
tachies:
  default:
    src: assets/characters/xiaoyun.webp
relationships:
  - targetId: hamster
    type: friend
favoriteSnack: sunflower seeds
---

Opening note kept by authors.

## 外貌

短发。

## 灵感来源

A custom section.

## 性格

开朗。
`

describe('character serializer with source', () => {
  it('returns an unchanged character byte for byte', () => {
    expect(stringifyCharacterMd(parseCharacterMd(CHARACTER), { source: CHARACTER })).toBe(CHARACTER)
  })

  it('keeps unknown frontmatter and body sections when fields change', () => {
    const character: AdvCharacter = {
      ...parseCharacterMd(CHARACTER),
      name: '小云 (新)',
      personality: '安静。',
      background: '来自海边。',
    }
    const output = stringifyCharacterMd(character, { source: CHARACTER })

    expect(output).toBe(`---
id: xiaoyun
name: 小云 (新)
tachies:
  default:
    src: assets/characters/xiaoyun.webp
relationships:
  - targetId: hamster
    type: friend
favoriteSnack: sunflower seeds
---

Opening note kept by authors.

## 外貌

短发。

## 灵感来源

A custom section.

## 性格

安静。

## 背景

来自海边。
`)
    expect(parseCharacterMd(output)).toEqual(character)
  })

  it('drops a cleared section without touching neighbours', () => {
    const output = stringifyCharacterMd({ ...parseCharacterMd(CHARACTER), appearance: '' }, { source: CHARACTER })
    expect(output).not.toContain('## 外貌')
    expect(output).toContain('Opening note kept by authors.\n\n## 灵感来源\n\nA custom section.')
  })
})

describe('updateChapterMd', () => {
  const chapter = '---\ntitle: Day 1\nmood: sunny\n---\n\n【教室，白天，内景】\n@小云\n早上好。\n'

  it('returns unchanged chapter content as is', () => {
    expect(updateChapterMd(parseChapterMd(chapter, 'day-1.adv.md'))).toBe(chapter)
  })

  it('writes title and summary into the existing frontmatter only', () => {
    const output = updateChapterMd({ ...parseChapterMd(chapter, 'day-1.adv.md'), title: 'Day One', plotSummary: 'Arrival' })
    expect(output).toBe('---\ntitle: Day One\nmood: sunny\nplotSummary: Arrival\n---\n\n【教室，白天，内景】\n@小云\n早上好。\n')
  })

  it('adds frontmatter to a script without one', () => {
    const output = updateChapterMd({ filename: 'intro.adv.md', title: 'Intro', plotSummary: '', content: '@小云\n你好。\n' })
    expect(output).toBe('---\ntitle: Intro\n---\n\n@小云\n你好。\n')
    expect(updateChapterMd({ filename: 'intro.adv.md', title: 'intro', content: '@小云\n你好。\n' })).toBe('@小云\n你好。\n')
  })
})
