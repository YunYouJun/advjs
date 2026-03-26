import { describe, expect, it } from 'vitest'
import { exportCharacterForAI, parseCharacterMd, stringifyCharacterMd } from '../../packages/parser/src/character'

const SAMPLE_MD = `---
id: taki
name: 立花瀧
avatar: /img/characters/taki.png
actor: ''
cv: 神木隆之介
aliases:
  - Taki Tachibana
tags:
  - 主角
  - 男性
  - 高中生
faction: 東京
tachies:
  default:
    src: /img/your-name/characters/taki.png
    class:
      - h-full
  angry:
    src: /img/your-name/characters/taki-angry.png
relationships:
  - targetId: mitsuha
    type: 恋人
    description: 跨越时空的羁绊
---

## 外貌

17 岁少年，短发凌乱的黑发，穿着白衬衫黑西装外套灰裤子的高中校服。

## 性格

务实而坚定，但在与三叶交换身体之前，常常感到与周围环境格格不入。

## 背景

瀧是住在东京的高中生，在一家意大利餐厅打工，对建筑有着浓厚的兴趣。

## 理念

执着于寻找失去的记忆

## 说话风格

直接、略带急躁，但在关键时刻会变得温柔而坚定。
`

describe('character markdown parser', () => {
  describe('parseCharacterMd', () => {
    it('should parse frontmatter fields correctly', () => {
      const char = parseCharacterMd(SAMPLE_MD)
      expect(char.id).toBe('taki')
      expect(char.name).toBe('立花瀧')
      expect(char.avatar).toBe('/img/characters/taki.png')
      expect(char.cv).toBe('神木隆之介')
      expect(char.aliases).toEqual(['Taki Tachibana'])
      expect(char.tags).toEqual(['主角', '男性', '高中生'])
      expect(char.faction).toBe('東京')
    })

    it('should parse tachies correctly', () => {
      const char = parseCharacterMd(SAMPLE_MD)
      expect(char.tachies).toBeDefined()
      expect(char.tachies?.default?.src).toBe('/img/your-name/characters/taki.png')
      expect(char.tachies?.default?.class).toEqual(['h-full'])
      expect(char.tachies?.angry?.src).toBe('/img/your-name/characters/taki-angry.png')
    })

    it('should parse relationships correctly', () => {
      const char = parseCharacterMd(SAMPLE_MD)
      expect(char.relationships).toHaveLength(1)
      expect(char.relationships?.[0]).toEqual({
        targetId: 'mitsuha',
        type: '恋人',
        description: '跨越时空的羁绊',
      })
    })

    it('should parse body sections correctly', () => {
      const char = parseCharacterMd(SAMPLE_MD)
      expect(char.appearance).toBe('17 岁少年，短发凌乱的黑发，穿着白衬衫黑西装外套灰裤子的高中校服。')
      expect(char.personality).toBe('务实而坚定，但在与三叶交换身体之前，常常感到与周围环境格格不入。')
      expect(char.background).toBe('瀧是住在东京的高中生，在一家意大利餐厅打工，对建筑有着浓厚的兴趣。')
      expect(char.concept).toBe('执着于寻找失去的记忆')
      expect(char.speechStyle).toBe('直接、略带急躁，但在关键时刻会变得温柔而坚定。')
    })

    it('should support English section headings', () => {
      const md = `---
id: test
name: Test
---

## Appearance

Tall and handsome.

## Personality

Kind and brave.

## Background

A hero from the village.

## Concept

Justice above all.

## Speech Style

Calm and measured.
`
      const char = parseCharacterMd(md)
      expect(char.appearance).toBe('Tall and handsome.')
      expect(char.personality).toBe('Kind and brave.')
      expect(char.background).toBe('A hero from the village.')
      expect(char.concept).toBe('Justice above all.')
      expect(char.speechStyle).toBe('Calm and measured.')
    })

    it('should throw on missing id', () => {
      const md = `---
name: Test
---
`
      expect(() => parseCharacterMd(md)).toThrow('id')
    })

    it('should throw on missing name', () => {
      const md = `---
id: test
---
`
      expect(() => parseCharacterMd(md)).toThrow('name')
    })

    it('should handle minimal frontmatter', () => {
      const md = `---
id: simple
name: Simple Character
---
`
      const char = parseCharacterMd(md)
      expect(char.id).toBe('simple')
      expect(char.name).toBe('Simple Character')
      expect(char.appearance).toBeUndefined()
    })
  })

  describe('stringifyCharacterMd', () => {
    it('should produce valid markdown with frontmatter and body', () => {
      const char = parseCharacterMd(SAMPLE_MD)
      const output = stringifyCharacterMd(char)

      // Re-parse should produce equivalent result
      const reparsed = parseCharacterMd(output)
      expect(reparsed.id).toBe(char.id)
      expect(reparsed.name).toBe(char.name)
      expect(reparsed.aliases).toEqual(char.aliases)
      expect(reparsed.tags).toEqual(char.tags)
      expect(reparsed.appearance).toBe(char.appearance)
      expect(reparsed.personality).toBe(char.personality)
      expect(reparsed.background).toBe(char.background)
      expect(reparsed.concept).toBe(char.concept)
      expect(reparsed.speechStyle).toBe(char.speechStyle)
    })

    it('should handle character with only frontmatter', () => {
      const output = stringifyCharacterMd({ id: 'a', name: 'A' })
      expect(output).toContain('---')
      expect(output).toContain('id: a')
      expect(output).toContain('name: A')
    })
  })

  describe('exportCharacterForAI', () => {
    it('should produce clean AI-friendly markdown', () => {
      const char = parseCharacterMd(SAMPLE_MD)
      const output = exportCharacterForAI(char)

      expect(output).toContain('# 立花瀧')
      expect(output).toContain('**别名**: Taki Tachibana')
      expect(output).toContain('**阵营**: 東京')
      expect(output).toContain('**标签**: 主角, 男性, 高中生')
      expect(output).toContain('**声优**: 神木隆之介')
      expect(output).toContain('## 外貌')
      expect(output).toContain('## 关系')
      expect(output).toContain('**mitsuha** (恋人): 跨越时空的羁绊')
    })

    it('should not include tachies or avatar in AI export', () => {
      const char = parseCharacterMd(SAMPLE_MD)
      const output = exportCharacterForAI(char)
      expect(output).not.toContain('tachies')
      expect(output).not.toContain('/img/')
    })
  })

  describe('roundtrip', () => {
    it('should preserve data through parse → stringify → parse', () => {
      const original = parseCharacterMd(SAMPLE_MD)
      const stringified = stringifyCharacterMd(original)
      const reparsed = parseCharacterMd(stringified)

      expect(reparsed.id).toBe(original.id)
      expect(reparsed.name).toBe(original.name)
      expect(reparsed.cv).toBe(original.cv)
      expect(reparsed.aliases).toEqual(original.aliases)
      expect(reparsed.tags).toEqual(original.tags)
      expect(reparsed.faction).toBe(original.faction)
      expect(reparsed.tachies?.default?.src).toBe(original.tachies?.default?.src)
      expect(reparsed.relationships).toEqual(original.relationships)
      expect(reparsed.appearance).toBe(original.appearance)
      expect(reparsed.personality).toBe(original.personality)
      expect(reparsed.background).toBe(original.background)
      expect(reparsed.concept).toBe(original.concept)
      expect(reparsed.speechStyle).toBe(original.speechStyle)
    })
  })
})
