import { describe, expect, it } from 'vitest'
import { parseAudioMd, stringifyAudioMd } from '../utils/audioMd'

describe('parseAudioMd', () => {
  it('parses basic audio frontmatter', () => {
    const audio = parseAudioMd(`---
name: Battle Theme
description: Epic battle music
src: bgm/battle.mp3
---
`)
    expect(audio.name).toBe('Battle Theme')
    expect(audio.description).toBe('Epic battle music')
    expect(audio.src).toBe('bgm/battle.mp3')
  })

  it('throws on missing name', () => {
    expect(() => parseAudioMd(`---
src: test.mp3
---`)).toThrow('must have a string `name`')
  })

  it('parses tags and linked items', () => {
    const audio = parseAudioMd(`---
name: Rain
tags:
  - ambient
  - weather
linkedScenes:
  - forest
  - garden
---
`)
    expect(audio.tags).toEqual(['ambient', 'weather'])
    expect(audio.linkedScenes).toEqual(['forest', 'garden'])
  })

  it('uses body as description fallback', () => {
    const audio = parseAudioMd(`---
name: Test
---
Some description text`)
    expect(audio.description).toBe('Some description text')
  })

  it('strips undefined fields', () => {
    const audio = parseAudioMd(`---
name: Minimal
---`)
    expect(Object.keys(audio)).not.toContain('duration')
    expect(Object.keys(audio)).not.toContain('tags')
  })
})

describe('stringifyAudioMd', () => {
  it('produces valid frontmatter', () => {
    const output = stringifyAudioMd({ name: 'BGM', src: 'audio/bgm.mp3' })
    expect(output).toContain('---')
    expect(output).toContain('name: BGM')
    expect(output).toContain('src: audio/bgm.mp3')
  })

  it('omits empty arrays', () => {
    const output = stringifyAudioMd({ name: 'Test', tags: [] })
    expect(output).not.toContain('tags:')
  })

  it('omits undefined fields', () => {
    const output = stringifyAudioMd({ name: 'Min' })
    expect(output).not.toContain('duration:')
    expect(output).not.toContain('linkedScenes:')
  })
})
