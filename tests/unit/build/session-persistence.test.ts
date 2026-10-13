// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { SessionManager } from '../../../packages/core/src/engine/session'

it('preserves CLI filesystem persistence after loading the driver lazily', async () => {
  const root = await mkdtemp(join(tmpdir(), 'advjs-session-'))
  try {
    const sessions = new SessionManager(root)
    const session = await sessions.getOrCreate('test', 'story.adv.md', '[]')
    session.currentIndex = 2
    await sessions.save(session)

    const restored = new SessionManager(root)
    expect((await restored.get('test'))?.currentIndex).toBe(2)
    expect(await restored.list()).toEqual(['test'])
    await restored.delete('test')
    expect(await restored.get('test')).toBeNull()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
