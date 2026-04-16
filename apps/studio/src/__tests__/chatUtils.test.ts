import { describe, expect, it } from 'vitest'
import {
  extractMarkdown,
  formatChatTime,
  getCharacterInitials,
  getDomainIcon,
  getMoodEmoji,
  getValidAvatarUrl,
  parseAiJson,
} from '../utils/chatUtils'

describe('parseAiJson', () => {
  it('parses valid JSON', () => {
    const result = parseAiJson('{"a":1}', raw => ({ a: raw.a as number }))
    expect(result).toEqual({ a: 1 })
  })

  it('strips code fences before parsing', () => {
    const result = parseAiJson('```json\n{"a":1}\n```', raw => ({ a: raw.a as number }))
    expect(result).toEqual({ a: 1 })
  })

  it('returns null for invalid JSON', () => {
    const result = parseAiJson('not json', raw => raw)
    expect(result).toBeNull()
  })

  it('returns null when validate throws', () => {
    const result = parseAiJson('{"a":1}', () => {
      throw new Error('bad')
    })
    expect(result).toBeNull()
  })
})

describe('extractMarkdown', () => {
  it('strips markdown code fences', () => {
    expect(extractMarkdown('```markdown\nhello\n```')).toBe('hello')
  })

  it('strips md code fences', () => {
    expect(extractMarkdown('```md\nworld\n```')).toBe('world')
  })

  it('returns trimmed text when no fences', () => {
    expect(extractMarkdown('  hello  ')).toBe('hello')
  })
})

describe('formatChatTime', () => {
  it('returns HH:MM format', () => {
    const ts = new Date(2024, 0, 1, 14, 30).getTime()
    const result = formatChatTime(ts)
    expect(result).toMatch(/14:30|2:30/)
  })
})

describe('getMoodEmoji', () => {
  it('returns correct emoji for known moods', () => {
    expect(getMoodEmoji('happy')).toBe('😊')
    expect(getMoodEmoji('angry')).toBe('😠')
    expect(getMoodEmoji('loving')).toBe('🥰')
  })

  it('returns neutral emoji for unknown mood', () => {
    expect(getMoodEmoji('confused')).toBe('😐')
  })
})

describe('getDomainIcon', () => {
  it('returns law icon for 法律', () => {
    expect(getDomainIcon('法律')).toBe('⚖️')
  })

  it('returns law icon for law (case-insensitive)', () => {
    expect(getDomainIcon('LAW')).toBe('⚖️')
  })

  it('returns default icon for unknown domain', () => {
    expect(getDomainIcon('cooking')).toBe('🎓')
  })
})

describe('getValidAvatarUrl', () => {
  it('accepts http URLs', () => {
    expect(getValidAvatarUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })

  it('accepts data URIs', () => {
    expect(getValidAvatarUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  it('accepts blob URIs', () => {
    expect(getValidAvatarUrl('blob:http://localhost/abc')).toBe('blob:http://localhost/abc')
  })

  it('rejects relative paths', () => {
    expect(getValidAvatarUrl('images/a.png')).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(getValidAvatarUrl()).toBe('')
  })
})

describe('getCharacterInitials', () => {
  it('returns first two characters', () => {
    expect(getCharacterInitials('Alice')).toBe('Al')
  })

  it('returns fallback for empty name', () => {
    expect(getCharacterInitials('', '?')).toBe('?')
  })

  it('handles short names', () => {
    expect(getCharacterInitials('A')).toBe('A')
  })
})
