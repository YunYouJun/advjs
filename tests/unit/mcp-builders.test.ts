// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseSceneFrontmatter } from '../../packages/advjs/node/commands/utils'
import { buildChapterContent, buildSceneMd } from '../../packages/mcp-server/src/index'

describe('buildSceneMd', () => {
  it('emits frontmatter that parseSceneFrontmatter can roundtrip', () => {
    const md = buildSceneMd({
      id: 'classroom',
      name: '教室',
      tags: ['内景', '学校'],
      imagePrompt: 'Anime classroom, afternoon sunlight, watercolor',
      description: '二年级三班。',
      atmosphere: '下午光线柔和。',
      chapters: ['CH01 转学第一天'],
    })
    const { id, name } = parseSceneFrontmatter(md)
    expect(id).toBe('classroom')
    expect(name).toBe('教室')
    expect(md).toContain('imagePrompt: "Anime classroom, afternoon sunlight, watercolor"')
    expect(md).toContain('## 描述')
    expect(md).toContain('## 氛围')
    expect(md).toContain('## 出现章节')
    expect(md).toContain('- CH01 转学第一天')
  })

  it('uses folded YAML scalar for multi-line imagePrompts', () => {
    const md = buildSceneMd({
      id: 'rooftop',
      name: '天台',
      imagePrompt: 'Anime rooftop\nsunset orange light\nwatercolor aesthetic',
    })
    expect(md).toContain('imagePrompt: >-')
    expect(md).toContain('  Anime rooftop')
    expect(md).toContain('  sunset orange light')
  })

  it('escapes embedded double quotes', () => {
    const md = buildSceneMd({
      id: 'sign',
      imagePrompt: 'A sign reading "Closed" on the door',
    })
    expect(md).toContain('imagePrompt: "A sign reading \\"Closed\\" on the door"')
  })

  it('omits optional sections when not provided', () => {
    const md = buildSceneMd({ id: 'bare' })
    expect(md).toContain('id: bare')
    expect(md).not.toContain('## 描述')
    expect(md).not.toContain('## 氛围')
    expect(md).not.toContain('imagePrompt:')
  })
})

describe('buildChapterContent', () => {
  it('returns content verbatim when provided', () => {
    expect(buildChapterContent({ filename: 'x', content: 'hello' })).toBe('hello')
  })

  it('emits frontmatter-only stub when content omitted', () => {
    const out = buildChapterContent({ filename: 'x', title: 'T1', plotSummary: 'S1' })
    expect(out).toBe('---\ntitle: T1\nplotSummary: S1\n---\n')
  })

  it('emits empty string when no fields are set', () => {
    expect(buildChapterContent({ filename: 'x' })).toBe('')
  })
})
