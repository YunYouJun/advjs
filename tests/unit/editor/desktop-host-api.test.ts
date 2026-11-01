import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { createDesktopHostApi } from '../../../apps/desktop/src/host-api'

describe('finite desktop document proxy', () => {
  it('accepts only trusted fixed loopback API roots', () => {
    expect(createDesktopHostApi()).toBeUndefined()
    for (const target of ['https://127.0.0.1:1/api/game/', 'http://example.com:80/api/game/', 'http://user@127.0.0.1:1/api/game/', 'http://127.0.0.1:1/', 'http://127.0.0.1:1/api/game/?url=elsewhere'])
      expect(() => createDesktopHostApi(target)).toThrow('fixed loopback')
  })
  it('forwards only the configured prefix, retains the finite port token and excludes Electron credentials', async () => {
    let received: unknown
    const upstream = createServer(async (req, res) => {
      let body = ''
      for await (const chunk of req) body += chunk
      received = { url: req.url, method: req.method, origin: req.headers.origin, auth: req.headers.authorization, token: req.headers['x-editor-token'], workspace: req.headers['x-advjs-workspace-session'], body }
      res.writeHead(409, { 'Content-Type': 'application/json' })
      res.end('{"message":"Conflict"}')
    })
    await new Promise<void>(done => upstream.listen(0, '127.0.0.1', done))
    const address = upstream.address()
    const origin = `http://127.0.0.1:${typeof address === 'object' ? address?.port : 0}`
    const proxy = createDesktopHostApi(`${origin}/api/game/`, 'bound-workspace')!
    const host = createServer(async (req, res) => {
      if (!await proxy(req, res)) {
        res.writeHead(404)
        res.end()
      }
    })
    await new Promise<void>(done => host.listen(0, '127.0.0.1', done))
    const hostAddress = host.address()
    const url = `http://127.0.0.1:${typeof hostAddress === 'object' ? hostAddress?.port : 0}`
    try {
      expect((await fetch(`${url}/unrelated`)).status).toBe(404)
      expect((await fetch(`${url}/api/game/..%2fprivate`)).status).toBe(404)
      expect(received).toBeUndefined()
      const result = await fetch(`${url}/api/game/chapter`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Editor-Token': 'document-token', 'Authorization': 'Bearer desktop-secret', 'X-Advjs-Workspace-Session': 'spoofed-other-window' }, body: '{}' })
      expect(result.status).toBe(409)
      expect(await result.json()).toEqual({ message: 'Conflict' })
      expect(received).toEqual({ url: '/api/game/chapter', method: 'PUT', origin, auth: undefined, token: 'document-token', workspace: 'bound-workspace', body: '{}' })
    }
    finally {
      host.closeAllConnections()
      upstream.closeAllConnections()
      await Promise.all([new Promise<void>(done => host.close(() => done())), new Promise<void>(done => upstream.close(() => done()))])
    }
  })
})
