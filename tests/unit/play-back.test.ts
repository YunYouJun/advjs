// @vitest-environment node

import type { PlaySession } from '../../packages/core/src/engine/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SessionManager } from '../../packages/core/src/engine/session'

// Integration coverage for the CLI `play back` flow.
//
// The CLI command is a thin wrapper around SessionManager.rollback +
// AdvPlayEngine.resumeSession; the rollback semantics themselves are tested
// in engine-rollback.test.ts. Here we verify the *contract the CLI promises*:
//   - reporting how many steps actually popped (vs how many the user asked for)
//   - leaving the on-disk session in a re-playable state
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

describe('play back — CLI semantics', () => {
  let dir: string
  let manager: SessionManager

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'advjs-back-cli-'))
    manager = new SessionManager(`${dir}/play-sessions`)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('reports the actually-popped step count (cap at history length)', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 7, history: [0, 3, 5, 7] }),
      ast: EMPTY_AST,
    })

    const before = await manager.get('demo')
    const beforeLen = before!.history!.length // 4

    const updated = await manager.rollback('demo', 99) // request more than available
    const popped = beforeLen - (updated!.history?.length ?? 0)

    expect(popped).toBe(4) // capped at history length
    expect(updated!.history).toEqual([])
    expect(updated!.currentIndex).toBe(0)
  })

  it('exact-1-step rollback returns popped=1 and lands on the previous top', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 5, history: [0, 2, 5] }),
      ast: EMPTY_AST,
    })

    const before = await manager.get('demo')
    const updated = await manager.rollback('demo', 1)
    const popped = (before!.history!.length) - (updated!.history?.length ?? 0)

    expect(popped).toBe(1)
    expect(updated!.currentIndex).toBe(2)
  })

  it('empty-history rollback returns popped=0 (no-op reporting)', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 5, history: [] }),
      ast: EMPTY_AST,
    })

    const before = await manager.get('demo')
    const updated = await manager.rollback('demo', 3)
    const popped = (before!.history?.length ?? 0) - (updated!.history?.length ?? 0)

    expect(popped).toBe(0)
    expect(updated!.currentIndex).toBe(5)
  })

  it('leaves session re-playable: status forced to playing after rollback from ended', async () => {
    await manager.importSnapshot({
      session: makeSession({ currentIndex: 10, history: [0, 5, 10], status: 'ended' }),
      ast: EMPTY_AST,
    })

    const updated = await manager.rollback('demo', 1)
    expect(updated!.status).toBe('playing')

    // The CLI then calls resumeSession; verify the session persisted to disk
    // is in fact resumable (status='playing' + valid currentIndex).
    const persisted = await manager.get('demo')
    expect(persisted!.status).toBe('playing')
    expect(persisted!.currentIndex).toBe(5)
  })
})
