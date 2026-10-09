// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { build, createServer } from 'vite'
import { describe, expect, it } from 'vitest'
import AdvDevTools from '../../../packages/devtools/src/vite'

// Uses the packaged SPA built by `pnpm devtools:build`.
describe('aDV.JS DevTools Vite integration', () => {
  it('mounts the panel and Devframe discovery on Vite, and closes its server', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-devtools-'))
    await writeFile(join(root, 'index.html'), '<html><head></head><body>Game</body></html>')
    const server = await createServer({ configFile: false, root, plugins: [AdvDevTools({ base: '/debug/adv/' })], logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } })
    try {
      await server.listen()
      const address = server.httpServer!.address() as { port: number }
      const origin = `http://127.0.0.1:${address.port}`
      const html = await fetch(origin).then(response => response.text())
      expect(html).toContain('/debug/adv/runtime.js')
      const panel = await fetch(`${origin}/debug/adv/`).then(response => response.text())
      expect(panel).toContain('<title>ADV.JS DevTools</title>')
      const runtime = await fetch(`${origin}/debug/adv/runtime.js`).then(response => response.text())
      expect(runtime).toContain('/@vite/client')
      const connection = await fetch(`${origin}/debug/adv/__connection.json`).then(response => response.json())
      expect(connection.backend).toBe('websocket')
      expect(connection.websocket).toBeDefined()
    }
    finally {
      await server.close()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not inject developer UI into a player build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-devtools-build-'))
    await writeFile(join(root, 'index.html'), '<html><head></head><body>Game</body></html>')
    try {
      const result = await build({ configFile: false, root, plugins: [AdvDevTools()], logLevel: 'silent', build: { write: false } })
      expect(JSON.stringify(result)).not.toContain('__advjs_devtools')
      expect(JSON.stringify(result)).not.toContain('devframe')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
