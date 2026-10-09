import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWorkspaceStateStorage, parseWorkspaceState } from '../../../apps/desktop/src/workspace-state'

describe('desktop project workspace persistence', () => {
  it('isolates project paths, serializes writes and recovers malformed state', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'advjs-state-'))
    try {
      const storage = createWorkspaceStateStorage(directory)
      await Promise.all([
        storage.write('/projects/a', { version: 1, openedFile: 'first.md' }),
        storage.write('/projects/a', { version: 1, openedFile: 'last.md', positions: { 'last.md': { lineNumber: 12, column: 4, scrollTop: 180, scrollLeft: 0 } } }),
        storage.write('/projects/b', { version: 1, activeViews: { main: 'advjs.core/audio' } }),
      ])
      const restored = createWorkspaceStateStorage(directory)
      expect(await restored.read('/projects/a')).toMatchObject({ openedFile: 'last.md', positions: { 'last.md': { lineNumber: 12 } } })
      expect(await restored.read('/projects/b')).toEqual({ version: 1, activeViews: { main: 'advjs.core/audio' } })
      expect(await restored.read('/projects/new')).toEqual({ version: 1 })
      const files = await readdir(directory)
      expect(files).toHaveLength(2)
      for (const file of files)
        await writeFile(resolve(directory, file), '{broken')
      expect(await restored.read('/projects/a')).toEqual({ version: 1 })
    }
    finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('rejects arbitrary paths, unbounded layout and credentials at the IPC boundary', () => {
    for (const openedFile of ['../secret', '/etc/passwd', 'C:\\secret', 'adv/../../secret'])
      expect(() => parseWorkspaceState({ version: 1, openedFile })).toThrow('Invalid opened file')
    expect(() => parseWorkspaceState({ version: 1, token: 'secret' })).toThrow()
    expect(() => parseWorkspaceState({ version: 1, layout: { name: 'root', size: 101 } })).toThrow()
    expect(() => parseWorkspaceState({ version: 1, positions: { 'file.md': { lineNumber: -1, column: 1, scrollTop: 0, scrollLeft: 0 } } })).toThrow()
    expect(() => parseWorkspaceState({ version: 1, positions: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [String(i), {}])) })).toThrow()
  })
})
