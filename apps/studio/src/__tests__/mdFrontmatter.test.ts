import { describe, expect, it } from 'vitest'
import { dumpYamlFrontmatter, parseFrontmatterAndBody } from '../utils/mdFrontmatter'

describe('parseFrontmatterAndBody', () => {
  it('parses standard frontmatter', () => {
    const { frontmatter, body } = parseFrontmatterAndBody(`---
id: test
name: Hello
---
Body content here`)
    expect(frontmatter).toBe('id: test\nname: Hello')
    expect(body).toBe('Body content here')
  })

  it('returns empty frontmatter when no delimiters', () => {
    const { frontmatter, body } = parseFrontmatterAndBody('Just plain text')
    expect(frontmatter).toBe('')
    expect(body).toBe('Just plain text')
  })

  it('returns empty frontmatter when only opening delimiter', () => {
    const { frontmatter, body } = parseFrontmatterAndBody('---\nno closing')
    expect(frontmatter).toBe('')
    expect(body).toBe('---\nno closing')
  })

  it('handles empty body', () => {
    const { frontmatter, body } = parseFrontmatterAndBody(`---
key: value
---`)
    expect(frontmatter).toBe('key: value')
    expect(body).toBe('')
  })

  it('handles empty content', () => {
    const { frontmatter, body } = parseFrontmatterAndBody('')
    expect(frontmatter).toBe('')
    expect(body).toBe('')
  })

  it('trims whitespace', () => {
    const { frontmatter, body } = parseFrontmatterAndBody(`
---
  id: x
---
  body
`)
    expect(frontmatter).toBe('id: x')
    expect(body).toBe('body')
  })
})

describe('dumpYamlFrontmatter', () => {
  it('dumps simple object', () => {
    const result = dumpYamlFrontmatter({ id: 'test', name: 'Hello' })
    expect(result).toContain('id: test')
    expect(result).toContain('name: Hello')
  })

  it('dumps arrays', () => {
    const result = dumpYamlFrontmatter({ tags: ['a', 'b'] })
    expect(result).toContain('tags:')
    expect(result).toContain('- a')
    expect(result).toContain('- b')
  })

  it('handles empty object', () => {
    const result = dumpYamlFrontmatter({})
    expect(result).toBe('{}')
  })
})
