// @vitest-environment node
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEditorBridge } from '../../../packages/advjs/node/editor'
import { applyEditorFileChanges } from '../../../packages/advjs/node/editor/mutations'

describe('project disk mutations', () => {
  it('imports byte-exact audio and rejects collisions, stale text and escaping parents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-binary-'))
    const project = join(root, '中文 项目')
    const ui = join(root, 'ui')
    await mkdir(project)
    await mkdir(ui)
    await writeFile(join(ui, 'index.html'), '<main>Editor</main>')
    const bridge = await createEditorBridge({ projectRoot: project, publicRoot: ui, port: 0 })
    try {
      const ready = await bridge.start()
      const headers = { authorization: `Bearer ${bridge.token}` }
      const endpoint = new URL('/__advjs/api/asset?path=adv/assets/audio/雨.wav', ready.url)
      const bytes = Buffer.from([82, 73, 70, 70, 0, 255, 128, 0, 87, 65, 86, 69])
      expect((await fetch(endpoint, { method: 'PUT', headers, body: bytes })).status).toBe(200)
      expect(await readFile(join(project, 'adv/assets/audio/雨.wav'))).toEqual(bytes)
      const media = await fetch(endpoint, { headers })
      expect(media.headers.get('content-type')).toBe('audio/wav')
      expect(Buffer.from(await media.arrayBuffer())).toEqual(bytes)
      expect((await fetch(endpoint, { method: 'PUT', headers, body: bytes })).status).toBe(409)
      await applyEditorFileChanges(project, [{ path: 'adv/characters/new.character.md', content: '---\nid: new\nname: 新角色\n---\n', expected: null }])
      await expect(applyEditorFileChanges(project, [{ path: 'adv/characters/new.character.md', content: 'overwrite', expected: 'stale' }])).rejects.toMatchObject({ statusCode: 409 })
      const changes = new URL('/__advjs/api/changes', ready.url)
      const vue = '<template><main>主题首页</main></template>'
      expect((await fetch(changes, { method: 'POST', headers, body: JSON.stringify([{ path: 'pages/start.vue', content: vue, expected: null }]) })).status).toBe(200)
      expect(await readFile(join(project, 'pages/start.vue'), 'utf8')).toBe(vue)
      expect((await fetch(changes, { method: 'POST', headers, body: JSON.stringify([{ path: 'pages/start.vue', content: 'overwrite', expected: null }]) })).status).toBe(409)
      await expect(applyEditorFileChanges(project, [{ path: 'public/avatar.webp', content: 'invalid text', expected: null }])).rejects.toMatchObject({ statusCode: 400 })
      await symlink(root, join(project, 'escaped'))
      await expect(applyEditorFileChanges(project, [{ path: 'escaped/private.md', content: 'x', expected: null }])).rejects.toMatchObject({ statusCode: 403 })
      expect((await fetch(new URL('/__advjs/api/asset?path=../private.wav', ready.url), { method: 'PUT', headers, body: bytes })).status).toBe(400)
    }
    finally {
      await bridge.stop()
      await rm(root, { recursive: true, force: true })
    }
  })
})
