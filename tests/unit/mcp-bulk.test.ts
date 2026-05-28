// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildSceneMd, planBulkWrites } from '../../packages/mcp-server/src/index'

describe('planBulkWrites — atomic preflight', () => {
  it('returns a clean plan when no conflicts', () => {
    const exists = () => false
    const items = [
      { id: 'a' },
      { id: 'b' },
    ]
    const { planned, conflicts } = planBulkWrites(
      items,
      item => ({ rel: `scenes/${item.id}.md`, content: buildSceneMd(item) }),
      rel => `/tmp/${rel}`,
      exists,
    )
    expect(conflicts).toEqual([])
    expect(planned).toHaveLength(2)
    expect(planned[0].path).toBe('/tmp/scenes/a.md')
    expect(planned[0].content).toContain('id: a')
  })

  it('detects duplicate ids within the same batch', () => {
    const items = [
      { id: 'classroom' },
      { id: 'rooftop' },
      { id: 'classroom' },
    ]
    const { conflicts } = planBulkWrites(
      items,
      item => ({ rel: `scenes/${item.id}.md`, content: buildSceneMd(item) }),
      rel => `/tmp/${rel}`,
      () => false,
    )
    expect(conflicts.some(c => c.includes('scenes/classroom.md'))).toBe(true)
  })

  it('detects pre-existing files via the exists predicate', () => {
    const items = [
      { id: 'shrine' },
      { id: 'temple' },
    ]
    const { conflicts } = planBulkWrites(
      items,
      item => ({ rel: `scenes/${item.id}.md`, content: buildSceneMd(item) }),
      rel => `/tmp/${rel}`,
      path => path.endsWith('shrine.md'),
    )
    expect(conflicts.some(c => c.includes('shrine.md already exists'))).toBe(true)
    expect(conflicts.some(c => c.includes('temple'))).toBe(false)
  })

  it('keeps planned[] complete even when there are conflicts (so callers can introspect)', () => {
    const items = [
      { id: 'a' },
      { id: 'b' },
      { id: 'a' },
    ]
    const { planned, conflicts } = planBulkWrites(
      items,
      item => ({ rel: `scenes/${item.id}.md`, content: buildSceneMd(item) }),
      rel => `/tmp/${rel}`,
      () => false,
    )
    expect(conflicts).not.toHaveLength(0)
    // planned still has all three so a UI could show what would have been written
    expect(planned).toHaveLength(3)
  })
})
