// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEditorBridge } from '../../../packages/advjs/node/editor'
import { withProjectWriteLock } from '../../../packages/advjs/node/project/write-lock'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-voice-lock-'))
  roots.push(root)
  return root
}

describe('voice and cooperating project writers', () => {
  it('queues writers and releases the lock after failures', async () => {
    const root = await fixture()
    const events: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let started!: () => void
    const began = new Promise<void>((resolve) => {
      started = resolve
    })
    const first = withProjectWriteLock(root, async () => {
      events.push('first')
      started()
      await gate
      throw new Error('Failed writer')
    })
    const failed = expect(first).rejects.toThrow('Failed writer')
    await began
    const second = withProjectWriteLock(root, async () => {
      events.push('second')
    })
    expect(events).toEqual(['first'])
    release()
    await failed
    await second
    expect(events).toEqual(['first', 'second'])
    await expect(readFile(join(root, '.advjs/catalog-write.lock'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('serializes an existing Editor write with a CLI voice operation', async () => {
    const root = await fixture()
    await mkdir(join(root, 'public'))
    await writeFile(join(root, 'public/index.html'), '<html></html>')
    await writeFile(join(root, 'draft.md'), 'Original')
    const bridge = await createEditorBridge({ projectRoot: root, publicRoot: join(root, 'public'), port: 0 })
    try {
      const ready = await bridge.start()
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let started!: () => void
      const began = new Promise<void>((resolve) => {
        started = resolve
      })
      const writer = withProjectWriteLock(root, async () => {
        started()
        await gate
      })
      await began
      const pending = fetch(`${new URL(ready.url).origin}/__advjs/api/file?path=draft.md`, { method: 'PUT', body: 'Saved', headers: { authorization: `Bearer ${bridge.token}` } })
      try {
        await new Promise(resolve => setTimeout(resolve, 40))
        expect(await readFile(join(root, 'draft.md'), 'utf8')).toBe('Original')
      }
      finally { release() }
      await writer
      expect((await pending).status).toBe(200)
      expect(await readFile(join(root, 'draft.md'), 'utf8')).toBe('Saved')
    }
    finally { await bridge.stop() }
  })

  it('refuses a project lock directory pointing outside the project', async () => {
    const root = await fixture()
    const outside = await fixture()
    await symlink(outside, join(root, '.advjs'))
    await expect(withProjectWriteLock(root, async () => {})).rejects.toMatchObject({ code: 'ADV_VALIDATION' })
  })
})
