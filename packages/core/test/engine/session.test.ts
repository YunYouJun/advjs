import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SessionManager } from '../../src/engine/session'

function createManager() {
  const dir = path.join(tmpdir(), `advjs-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return new SessionManager(dir)
}

describe('sessionManager', () => {
  const managers: SessionManager[] = []

  function tracked() {
    const m = createManager()
    managers.push(m)
    return m
  }

  afterEach(async () => {
    for (const m of managers) {
      const keys = await m.list()
      for (const k of keys)
        await m.delete(k)
    }
    managers.length = 0
  })

  it('should create and retrieve a session', async () => {
    const mgr = tracked()
    const session = await mgr.getOrCreate('s1', '/test.adv.md', '{}')

    expect(session.id).toBe('s1')
    expect(session.status).toBe('playing')
    expect(session.currentIndex).toBe(0)

    const retrieved = await mgr.get('s1')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe('s1')
  })

  it('should return existing session on duplicate create', async () => {
    const mgr = tracked()
    const s1 = await mgr.getOrCreate('dup', '/a.adv.md', '{}')
    s1.currentIndex = 5
    await mgr.save(s1)

    const s2 = await mgr.getOrCreate('dup', '/a.adv.md', '{}')
    expect(s2.currentIndex).toBe(5) // preserved, not reset
  })

  it('should delete a session', async () => {
    const mgr = tracked()
    await mgr.getOrCreate('del', '/test.adv.md', '{}')
    await mgr.delete('del')

    expect(await mgr.get('del')).toBeNull()
  })

  it('should list sessions', async () => {
    const mgr = tracked()
    await mgr.getOrCreate('a', '/a.adv.md', '{}')
    await mgr.getOrCreate('b', '/b.adv.md', '{}')

    const keys = await mgr.list()
    expect(keys).toContain('a')
    expect(keys).toContain('b')
    expect(keys).toHaveLength(2)
  })

  it('should export and import session snapshots', async () => {
    const mgr = tracked()
    const session = await mgr.getOrCreate('save-me', '/a.adv.md', '{"type":"adv-root"}')
    session.currentIndex = 3
    session.background = 'school'
    session.bgm = 'opening-theme'
    session.tachies = { aria: { status: 'smile' } }
    await mgr.save(session)

    const snapshot = await mgr.exportSnapshot('save-me')
    expect(snapshot).not.toBeNull()
    expect(snapshot!.session.currentIndex).toBe(3)
    expect(snapshot!.session.bgm).toBe('opening-theme')

    const restored = await mgr.importSnapshot(snapshot!, 'loaded-save')
    expect(restored.id).toBe('loaded-save')
    expect(restored.currentIndex).toBe(3)

    const loaded = await mgr.get('loaded-save')
    expect(loaded!.background).toBe('school')
    expect(loaded!.tachies.aria.status).toBe('smile')
  })

  it('should return null for non-existent session', async () => {
    const mgr = tracked()
    expect(await mgr.get('nope')).toBeNull()
  })
})
