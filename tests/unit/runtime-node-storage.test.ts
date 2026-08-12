// @vitest-environment node

import type { RuntimeSaveRecord } from '../../packages/core/src/storage'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFileRuntimeStorage } from '../../packages/advjs/node/runtime/storage'

function record(id: string, updatedAt = 1): RuntimeSaveRecord {
  return {
    id,
    snapshot: {
      schemaVersion: 1,
      program: { id: 'program', hash: 'program-v1' },
      state: {
        status: 'playing',
        cursor: { chapterId: 'chapter-1', nodeId: 'line' },
        variables: {},
        stage: { background: '', bgm: '', cg: '', tachies: {} },
        choices: [],
        visited: [],
      },
      checkpoints: [],
      createdAt: 1,
    },
    metadata: { label: id },
    updatedAt,
  }
}

describe('file runtime storage', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-runtime-storage-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('persists validated records atomically and returns clones', async () => {
    const storage = createFileRuntimeStorage(directory)
    const input = record('../safe-slot', 2)
    await storage.set(input)
    input.metadata!.label = 'mutated'

    expect(await storage.get('../safe-slot')).toMatchObject({ metadata: { label: '../safe-slot' } })
    expect((await readdir(directory)).filter(file => file.endsWith('.tmp'))).toEqual([])
    expect((await readdir(directory))).toHaveLength(1)

    const file = join(directory, (await readdir(directory))[0])
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(await storage.get('../safe-slot'))
  })

  it('lists newest first, overwrites, and deletes records', async () => {
    const first = createFileRuntimeStorage(directory)
    await first.set(record('a', 1))
    await first.set(record('b', 3))
    await first.set(record('c', 2))

    const second = createFileRuntimeStorage(directory)
    expect((await second.list()).map(item => item.id)).toEqual(['b', 'c', 'a'])
    await second.set({ ...record('a', 4), metadata: { overwritten: true } })
    expect((await first.list()).map(item => item.id)).toEqual(['a', 'b', 'c'])

    await second.remove('b')
    await second.remove('missing')
    expect(await first.get('b')).toBeUndefined()
  })

  it('rejects invalid records before writing', async () => {
    const storage = createFileRuntimeStorage(directory)
    const invalid = record('bad')
    Object.assign(invalid.metadata!, { value: undefined })

    await expect(storage.set(invalid)).rejects.toThrow(/ADV_RUNTIME_INVALID_SAVE_RECORD/)
    expect(await readdir(directory)).toEqual([])
  })
})
