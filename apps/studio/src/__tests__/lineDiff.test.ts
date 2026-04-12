import { describe, expect, it } from 'vitest'
import { computeLineDiff } from '../utils/lineDiff'

describe('computeLineDiff', () => {
  it('returns empty diff for identical content', () => {
    const diff = computeLineDiff('test.md', 'hello\nworld', 'hello\nworld')
    expect(diff.addedCount).toBe(0)
    expect(diff.removedCount).toBe(0)
    expect(diff.lines.every(l => l.type === 'unchanged')).toBe(true)
  })

  it('detects added lines', () => {
    const diff = computeLineDiff('test.md', 'line1', 'line1\nline2')
    expect(diff.addedCount).toBeGreaterThan(0)
    expect(diff.lines.some(l => l.type === 'added' && l.content === 'line2')).toBe(true)
  })

  it('detects removed lines', () => {
    const diff = computeLineDiff('test.md', 'line1\nline2', 'line1')
    expect(diff.removedCount).toBeGreaterThan(0)
    expect(diff.lines.some(l => l.type === 'removed' && l.content === 'line2')).toBe(true)
  })

  it('detects modifications', () => {
    const diff = computeLineDiff('test.md', 'hello', 'world')
    expect(diff.addedCount).toBeGreaterThan(0)
    expect(diff.removedCount).toBeGreaterThan(0)
  })

  it('preserves filename', () => {
    const diff = computeLineDiff('my-file.ts', 'a', 'b')
    expect(diff.filename).toBe('my-file.ts')
  })

  it('preserves before and after', () => {
    const diff = computeLineDiff('f.md', 'before', 'after')
    expect(diff.before).toBe('before')
    expect(diff.after).toBe('after')
  })

  it('handles empty strings', () => {
    const diff = computeLineDiff('f.md', '', 'new content')
    expect(diff.addedCount).toBeGreaterThan(0)
    expect(diff.removedCount).toBe(0)
  })

  it('handles multiline diff', () => {
    const before = 'line1\nline2\nline3'
    const after = 'line1\nmodified\nline3\nline4'
    const diff = computeLineDiff('f.md', before, after)
    expect(diff.addedCount).toBeGreaterThan(0)
    expect(diff.removedCount).toBeGreaterThan(0)
  })
})
