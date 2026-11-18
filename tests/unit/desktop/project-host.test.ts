import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEditorProjectHost, createEditorProjectHostClient } from '../../../packages/editor-sdk/src/node'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanups.splice(0)) await close()
})
async function fixture() {
  let commit: (() => void) | undefined
  const writes: string[] = []
  const checks: string[] = []
  const host = await createEditorProjectHost({ id: 'example.text', title: 'Text', apiPrefix: '/api/text', async inspect(path) {
    if (path === '/null') {
      // eslint-disable-next-line no-throw-literal -- third-party adapters can reject with non-Error values
      throw null
    }
    if (typeof path !== 'string' || !path.startsWith('/repo'))
      throw new Error('Not a text repository')
    return { root: path, name: 'Text' }
  }, async validateAccess(repo) { checks.push(repo.root) }, open(repo, lease) {
    return async (req, res) => {
      try {
        await lease.validateAccess()
        if (req.method === 'PUT') {
          await new Promise<void>((done) => {
            commit = done
          })
          await lease.validateAccess()
          writes.push(repo.root)
        }
        res.end(repo.root)
      }
      catch {
        res.statusCode = 410
        res.end('retired')
      }
    }
  } }, '/repo-a')
  const server = createServer(async (req, res) => {
    if (await host.handleRequest(req, res))
      return
    await host.api(req, res, () => {
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  cleanups.push(async () => {
    host.dispose()
    server.closeAllConnections()
    await new Promise<void>(done => server.close(() => done()))
  })
  const address = server.address()
  const origin = `http://127.0.0.1:${typeof address === 'object' ? address?.port : 0}`
  const client = createEditorProjectHostClient(origin + host.controlPath, host.controlToken)!
  return { host, client, origin, writes, checks, releaseCommit: () => commit?.(), pending: () => !!commit }
}
describe('sDK project host with a non-story adapter', () => {
  it('isolates repositories and revokes in-flight writes before commit', async () => {
    const { client, origin, writes, releaseCommit, pending } = await fixture()
    expect((await client.info()).id).toBe('example.text')
    const a = await client.open('/repo-a')
    const b = await client.open('/repo-b')
    const api = (token: string, method = 'GET') => fetch(`${origin}/api/text/document`, { method, headers: { 'X-Advjs-Workspace-Session': token } })
    expect((await api('bad')).status).toBe(403)
    expect(await (await api(b.apiToken)).text()).toBe('/repo-b')
    const request = api(a.apiToken, 'PUT')
    await vi.waitFor(() => expect(pending()).toBe(true))
    await client.release(a.id)
    releaseCommit()
    expect((await request).status).toBe(410)
    expect(writes).toEqual([])
    expect((await api(a.apiToken)).status).toBe(403)
    expect((await api(b.apiToken)).status).toBe(200)
  })
  it('rejects renderer-origin control, malformed input, wrong token and post-disposal operations', async () => {
    const { host, client, origin } = await fixture()
    const control = (body: string, headers = {}) => fetch(origin + host.controlPath, { method: 'POST', headers: { 'X-Advjs-Workspace-Token': host.controlToken, ...headers }, body })
    expect((await control('{}', { Origin: origin })).status).toBe(403)
    expect((await control('{}', { 'X-Advjs-Workspace-Token': 'bad' })).status).toBe(403)
    for (const body of ['null', '[]', '{', '{}']) expect((await control(body)).status).toBe(400)
    expect((await control('x'.repeat(16385))).status).toBe(413)
    await expect(client.open('/other')).rejects.toThrow('Not a text repository')
    await expect(client.open('/null')).rejects.toThrow('Project host operation failed')
    host.dispose()
    expect((await control('{"operation":"info"}')).status).toBe(403)
  })
})
