import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SessionManager } from '../../packages/core/src/engine/session'

describe('sessionManager save slots', () => {
  let dir: string
  let manager: SessionManager

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'advjs-slot-'))
    manager = new SessionManager(`${dir}/play-sessions`)
    // Seed a fake session by importing a minimal snapshot
    await manager.importSnapshot({
      session: {
        id: 'demo',
        scriptPath: '/tmp/script.adv.md',
        ast: JSON.stringify({ type: 'adv-root', children: [], scene: {}, functions: {} }),
        currentIndex: 3,
        choices: {},
        tachies: {},
        background: '',
        bgm: '',
        status: 'playing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      ast: JSON.stringify({ type: 'adv-root', children: [], scene: {}, functions: {} }),
    })
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects invalid slot names', async () => {
    await expect(
      manager.saveSlot('demo', '../escape', {
        scriptPath: '/tmp/script.adv.md',
        currentIndex: 3,
        totalNodes: 10,
      }),
    ).rejects.toThrow()
  })

  it('saves and loads a named slot with metadata', async () => {
    const meta = await manager.saveSlot('demo', 'quick', {
      scriptPath: '/tmp/script.adv.md',
      currentIndex: 3,
      totalNodes: 10,
      chapterTitle: 'Chapter 1',
      previewText: 'hello world',
      note: 'before fork',
    })
    expect(meta.slot).toBe('quick')
    expect(meta.sessionId).toBe('demo')
    expect(meta.chapterTitle).toBe('Chapter 1')

    const entry = await manager.loadSlot('demo', 'quick')
    expect(entry).toBeTruthy()
    expect(entry!.meta.note).toBe('before fork')
    expect(entry!.snapshot.session.currentIndex).toBe(3)
  })

  it('lists slots newest-first', async () => {
    await manager.saveSlot('demo', 'slot-a', {
      scriptPath: '/tmp/script.adv.md',
      currentIndex: 1,
      totalNodes: 10,
    })
    // small delay to ensure createdAt diverges
    await new Promise(r => setTimeout(r, 5))
    await manager.saveSlot('demo', 'slot-b', {
      scriptPath: '/tmp/script.adv.md',
      currentIndex: 2,
      totalNodes: 10,
    })
    const slots = await manager.listSlots('demo')
    const names = slots.map(s => s.slot)
    expect(names).toContain('slot-a')
    expect(names).toContain('slot-b')
    // Newer one should appear before older one
    expect(slots[0].createdAt).toBeGreaterThanOrEqual(slots[slots.length - 1].createdAt)
  })

  it('deletes a slot and returns the existence flag', async () => {
    await manager.saveSlot('demo', 'delete-me', {
      scriptPath: '/tmp/script.adv.md',
      currentIndex: 1,
      totalNodes: 10,
    })
    expect(await manager.deleteSlot('demo', 'delete-me')).toBe(true)
    expect(await manager.deleteSlot('demo', 'delete-me')).toBe(false)
    expect(await manager.loadSlot('demo', 'delete-me')).toBeNull()
  })
})
