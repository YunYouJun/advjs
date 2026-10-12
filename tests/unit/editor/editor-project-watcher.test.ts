// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { atomicProjectWrite } from '../../../packages/advjs/node/editor/mutations'
import { watchEditorProject } from '../../../packages/advjs/node/editor/project-watcher'

describe('editor source notifications', () => {
  it('observes external edits after repeated atomic source saves', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-project-watch-'))
    const directory = join(root, 'adv/chapters')
    await mkdir(directory, { recursive: true })
    const path = join(directory, 'intro.chapter.json')
    await writeFile(path, '{"version":0}')
    const events: Array<{ event: string, path: string }> = []
    const watcher = await watchEditorProject(root, change => events.push(change))
    try {
      expect(events).toEqual([])
      for (let version = 1; version <= 3; version++) {
        const before = events.filter(event => event.path === 'adv/chapters/intro.chapter.json').length
        await atomicProjectWrite(path, JSON.stringify({ version }))
        await expect.poll(() => events.filter(event => event.path === 'adv/chapters/intro.chapter.json').length, { timeout: 5000 }).toBeGreaterThan(before)
        // Complete the watcher's short event coalescing window before a new edit.
        await delay(100)
        const afterSave = events.filter(event => event.path === 'adv/chapters/intro.chapter.json').length
        await writeFile(path, JSON.stringify({ version, external: 'changed' }))
        await expect.poll(() => events.filter(event => event.path === 'adv/chapters/intro.chapter.json').length, { timeout: 5000 }).toBeGreaterThan(afterSave)
        await delay(100)
      }
    }
    finally {
      await watcher.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
