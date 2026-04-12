import { describe, expect, it } from 'vitest'
import { parseChapterMd, stringifyChapterMd } from '../utils/chapterMd'

describe('parseChapterMd', () => {
  it('parses frontmatter with title and plotSummary', () => {
    const ch = parseChapterMd(`---
title: Chapter 1
plotSummary: The hero wakes up
---
@Hero
Hello world`, 'chapter_01.adv.md')
    expect(ch.title).toBe('Chapter 1')
    expect(ch.plotSummary).toBe('The hero wakes up')
    expect(ch.filename).toBe('chapter_01.adv.md')
  })

  it('falls back title to filename without extension', () => {
    const ch = parseChapterMd('No frontmatter content', 'intro.adv.md')
    expect(ch.title).toBe('intro')
  })

  it('uses description as plotSummary fallback', () => {
    const ch = parseChapterMd(`---
description: Alt summary
---`, 'test.adv.md')
    expect(ch.plotSummary).toBe('Alt summary')
  })

  it('preserves full content', () => {
    const content = `---
title: Test
---
@Character
Dialog here`
    const ch = parseChapterMd(content, 'test.adv.md')
    expect(ch.content).toBe(content)
  })
})

describe('stringifyChapterMd', () => {
  it('returns existing content as-is', () => {
    const result = stringifyChapterMd({
      filename: 'test.adv.md',
      title: 'Test',
      plotSummary: 'Summary',
      content: '@Hero\nHello',
    })
    expect(result).toBe('@Hero\nHello')
  })

  it('generates frontmatter template when content is empty', () => {
    const result = stringifyChapterMd({
      filename: 'test.adv.md',
      title: 'Chapter 1',
      plotSummary: 'Opening',
      content: '',
    })
    expect(result).toContain('---')
    expect(result).toContain('title: Chapter 1')
    expect(result).toContain('plotSummary: Opening')
  })

  it('returns empty string for empty chapter', () => {
    const result = stringifyChapterMd({
      filename: 'test.adv.md',
      title: '',
      content: '',
    })
    expect(result).toBe('')
  })
})
