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

  it('should return null for non-existent session', async () => {
    const mgr = tracked()
    expect(await mgr.get('nope')).toBeNull()
  })
})
