// @vitest-environment node

import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createEditorBridge,
  EditorBridgeError,
} from '../../packages/advjs/node/editor'

const temporaryRoots: string[] = []

async function fixture() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-editor-bridge-'))
  temporaryRoots.push(temporaryRoot)
  const projectRoot = join(temporaryRoot, 'project')
  const publicRoot = join(temporaryRoot, 'public')
  await Promise.all([
    mkdir(join(projectRoot, 'adv'), { recursive: true }),
    mkdir(publicRoot, { recursive: true }),
  ])
  await Promise.all([
    writeFile(join(publicRoot, 'index.html'), '<main>ADV.JS Editor</main>', 'utf8'),
    writeFile(join(projectRoot, 'adv.config.json'), '{"root":"./adv"}\n', 'utf8'),
    writeFile(join(projectRoot, 'adv', 'chapter.adv.md'), '# Chapter\n', 'utf8'),
    writeFile(join(temporaryRoot, 'outside.txt'), 'private', 'utf8'),
  ])
  await symlink(join(temporaryRoot, 'outside.txt'), join(projectRoot, 'outside-link.txt'))
  return { projectRoot, publicRoot, temporaryRoot }
}

function apiHeaders(token: string, origin?: string) {
  return {
    authorization: `Bearer ${token}`,
    ...(origin ? { origin } : {}),
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('editor bridge', () => {
  it('serves the installed UI and protects explicit file and command APIs', async () => {
    const { projectRoot, publicRoot } = await fixture()
    const commands: string[] = []
    const bridge = await createEditorBridge({
      host: '127.0.0.1',
      port: 0,
      projectRoot,
      publicRoot,
      runCommand: async (command) => {
        commands.push(command)
        return { command, passed: true }
      },
    })

    const ready = await bridge.start()
    expect(ready.root).toBe(await realpath(projectRoot))
    expect(ready.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/#advjs-token=/u)
    expect(await (await fetch(ready.url)).text()).toContain('ADV.JS Editor')

    const apiUrl = new URL('/__advjs/api/file?path=adv.config.json', ready.url)
    expect((await fetch(apiUrl)).status).toBe(401)
    expect((await fetch(apiUrl, { headers: apiHeaders(bridge.token, 'https://evil.example') })).status).toBe(403)

    const readResponse = await fetch(apiUrl, { headers: apiHeaders(bridge.token) })
    expect(readResponse.status).toBe(200)
    expect(await readResponse.text()).toBe('{"root":"./adv"}\n')

    const projectResponse = await fetch(new URL('/__advjs/api/project', ready.url), {
      headers: apiHeaders(bridge.token),
    })
    expect(projectResponse.status).toBe(200)
    expect(await projectResponse.json()).toMatchObject({
      files: {
        'adv.config.json': '{"root":"./adv"}\n',
        'adv/chapter.adv.md': '# Chapter\n',
      },
    })

    const writeResponse = await fetch(apiUrl, {
      body: '{"root":"./adv","title":"Changed"}\n',
      headers: apiHeaders(bridge.token),
      method: 'PUT',
    })
    expect(writeResponse.status).toBe(200)
    expect(await (await fetch(apiUrl, { headers: apiHeaders(bridge.token) })).text()).toContain('Changed')

    const commandResponse = await fetch(new URL('/__advjs/api/commands/check', ready.url), {
      headers: apiHeaders(bridge.token),
      method: 'POST',
    })
    expect(commandResponse.status).toBe(200)
    expect(await commandResponse.json()).toEqual({ command: 'check', passed: true })
    expect(commands).toEqual(['check'])

    await bridge.stop()
    expect(bridge.started).toBe(false)
  })

  it('rejects traversal, escaping symlinks, remote hosts, and command injection', async () => {
    const { projectRoot, publicRoot } = await fixture()
    await expect(createEditorBridge({
      host: '0.0.0.0',
      port: 0,
      projectRoot,
      publicRoot,
    })).rejects.toMatchObject({ code: 'ADV_EDITOR' })

    const bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot })
    const ready = await bridge.start()
    const request = (path: string, method = 'GET') => fetch(
      new URL(`/__advjs/api/${path}`, ready.url),
      { headers: apiHeaders(bridge.token), method },
    )

    expect((await request('file?path=../outside.txt')).status).toBe(400)
    expect((await request('file?path=outside-link.txt')).status).toBe(403)
    expect((await request('commands/check%3Brm', 'POST')).status).toBe(404)
    expect((await request('commands/deploy', 'POST')).status).toBe(404)
    await bridge.stop()
  })

  it('maps port conflicts and supports repeated lifecycle cleanup', async () => {
    const { projectRoot, publicRoot } = await fixture()
    const occupied = createHttpServer()
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject)
      occupied.listen(0, '127.0.0.1', resolve)
    })
    const address = occupied.address()
    const port = address && typeof address !== 'string' ? address.port : 0
    const conflicting = await createEditorBridge({ host: '127.0.0.1', port, projectRoot, publicRoot })

    await expect(conflicting.start()).rejects.toBeInstanceOf(EditorBridgeError)
    await new Promise<void>(resolve => occupied.close(() => resolve()))

    const bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot })
    const first = await bridge.start()
    await bridge.stop()
    const second = await bridge.start()
    expect(second.url).not.toBe(first.url)
    await bridge.stop()
    await bridge.stop()
    expect(bridge.started).toBe(false)
  })
})
