/**
 * Sanity test for the contest demo bundler. Without this, a typo in the
 * `import.meta.glob` path would silently bundle zero files and break the
 * "Load Contest Demo" action with no obvious error at build time.
 */
import { describe, expect, it } from 'vitest'
import {
  CONTEST_DEMOS,
  contestDemoProjectId,
  hasContestDemo,
  loadContestDemoFiles,
} from '../utils/contestDemos'

describe('contestDemos · build-time bundle', () => {
  it('declares 3 contest demos', () => {
    expect(CONTEST_DEMOS).toHaveLength(3)
    expect(CONTEST_DEMOS.map(d => d.slug).sort()).toEqual([
      'history-talk',
      'life-story',
      'murder-mystery',
    ])
  })

  it('every declared demo has bundled files', () => {
    for (const meta of CONTEST_DEMOS)
      expect(hasContestDemo(meta.slug), `slug=${meta.slug}`).toBe(true)
  })

  it('returns project-relative paths starting with adv/', () => {
    const files = loadContestDemoFiles('life-story')
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      expect(f.path.startsWith('adv/'), f.path).toBe(true)
      expect(typeof f.content).toBe('string')
      expect(f.content.length).toBeGreaterThan(0)
    }
  })

  it('life-story includes the canonical world.md and at least one chapter', () => {
    const files = loadContestDemoFiles('life-story')
    const paths = files.map(f => f.path)
    expect(paths).toContain('adv/world.md')
    expect(paths.some(p => p.startsWith('adv/chapters/'))).toBe(true)
    expect(paths.some(p => p.startsWith('adv/characters/'))).toBe(true)
  })

  it('returns empty array for unknown slug (no throw)', () => {
    expect(loadContestDemoFiles('does-not-exist')).toEqual([])
    expect(hasContestDemo('does-not-exist')).toBe(false)
  })

  it('contestDemoProjectId is stable + namespaced', () => {
    expect(contestDemoProjectId('life-story')).toBe('demo-life-story')
    expect(contestDemoProjectId('foo')).toBe('demo-foo')
  })
})
