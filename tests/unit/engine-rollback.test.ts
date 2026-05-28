import type { PlaySession } from '../../packages/core/src/engine/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { SessionManager } from '../../packages/core/src/engine/session'

const EMPTY_AST = JSON.stringify({ type: 'adv-root', children: [], scene: {}, functions: {} })

function makeSession(overrides: Partial<PlaySession> = {}): PlaySession {
  const now = Date.now()
  return {
    id: 'demo',
    scriptPath: '/tmp/script.adv.md',
    ast: EMPTY_AST,
    currentIndex: 0,
    choices: {},
    tachies: {},
    background: '',
    bgm: '',
    status: 'playing',
    history: [],
    visitedNodes: [],
    unlockedCGs: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('sessionManager.rollback', () => {
  let dir: string
  let manager: SessionManager

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'advjs-rollback-'))
    manager = new SessionManager(`${dir}/play-sessions`)
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns null for an unknown session', async () => {
    expect(await manager.rollback('missing')).toBeNull()
  })

  it('is a no-op when the history is empty', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 5, history: [] }),
      ast: EMPTY_AST,
    })
    const result = await manager.rollback('demo')
    expect(result?.currentIndex).toBe(5)
    expect(result?.history).toEqual([])
  })

  it('pops the top of history and jumps to the remaining top', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 7, history: [0, 2, 5, 7] }),
      ast: EMPTY_AST,
    })
    const result = await manager.rollback('demo')
    expect(result?.history).toEqual([0, 2, 5])
    expect(result?.currentIndex).toBe(5)
    expect(result?.status).toBe('playing')
  })

  it('rolls back multiple steps in one call', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 10, history: [0, 2, 5, 7, 10] }),
      ast: EMPTY_AST,
    })
    const result = await manager.rollback('demo', 3)
    expect(result?.history).toEqual([0, 2])
    expect(result?.currentIndex).toBe(2)
  })

  it('caps at history length when steps exceeds available entries', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 4, history: [0, 4] }),
      ast: EMPTY_AST,
    })
    const result = await manager.rollback('demo', 99)
    expect(result?.history).toEqual([])
    expect(result?.currentIndex).toBe(0)
  })

  it('forces status back to playing when rolling back from a waiting/ended state', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 3, history: [0, 1, 3], status: 'ended' }),
      ast: EMPTY_AST,
    })
    const result = await manager.rollback('demo')
    expect(result?.status).toBe('playing')
    expect(result?.currentIndex).toBe(1)
  })

  it('ignores zero/negative steps', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 7, history: [0, 2, 5, 7] }),
      ast: EMPTY_AST,
    })
    const result = await manager.rollback('demo', 0)
    expect(result?.currentIndex).toBe(7)
    expect(result?.history).toEqual([0, 2, 5, 7])
  })
})
