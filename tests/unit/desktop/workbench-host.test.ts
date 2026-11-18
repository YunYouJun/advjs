// @vitest-environment node

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createWorkbenchHost } from '../../../apps/desktop/src/workbench-host'

describe('trusted workbench repository host', () => {
  it('loads the transpiled shell module outside the checkout before a development host is requested', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'advjs-workbench-startup-'))
    try {
      const source = await readFile(new URL('../../../apps/desktop/src/workbench-host.ts', import.meta.url), 'utf8')
      const output = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
      })
      const entry = join(directory, 'workbench-host.mjs')
      await writeFile(entry, output.outputText)
      await promisify(execFile)(process.execPath, [entry], { cwd: directory })
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
  it('accepts only a fixed local control endpoint with a main-process token', () => {
    expect(createWorkbenchHost()).toBeUndefined()
    for (const url of ['http://example.com:123/__advjs/workspaces', 'https://127.0.0.1:123/__advjs/workspaces', 'http://127.0.0.1:123/api/other', 'http://127.0.0.1:123/__advjs/workspaces?path=other'])
      expect(() => createWorkbenchHost(url, 'a'.repeat(64))).toThrow('fixed loopback')
    expect(() => createWorkbenchHost('http://127.0.0.1:123/__advjs/workspaces', 'bad')).toThrow()
  })
  it('owns control credentials, exposes only validated metadata and reports repository failures', async () => {
    const requests: any[] = []
    const server = createServer(async (req, res) => {
      let text = ''
      for await (const part of req) text += part
      const data = JSON.parse(text)
      requests.push({ ...data, token: req.headers['x-advjs-workspace-token'] })
      res.setHeader('Content-Type', 'application/json')
      if (data.operation === 'info') {
        res.end(JSON.stringify({ id: 'example.tool', title: 'Example', defaultRoot: '/repo' }))
      }
      else if (data.path === '/missing') {
        res.statusCode = 422
        res.end('{"message":"Missing repository"}')
      }
      else if (data.operation === 'release') {
        res.end('{}')
      }
      else {
        res.end(JSON.stringify({ root: '/repo', name: 'Repository', id: 'binding', apiToken: 'b'.repeat(64) }))
      }
    })
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
    const address = server.address()
    const host = createWorkbenchHost(`http://127.0.0.1:${typeof address === 'object' ? address?.port : 0}/__advjs/workspaces`, 'a'.repeat(64))!
    try {
      expect(await host.info()).toEqual({ id: 'example.tool', title: 'Example', defaultRoot: '/repo' })
      expect(await host.inspect('/repo')).toEqual({ root: '/repo', name: 'Repository' })
      expect((await host.open('/repo')).apiToken).toBe('b'.repeat(64))
      await host.release('binding')
      await expect(host.inspect('/missing')).rejects.toThrow('Missing repository')
      expect(requests.every(item => item.token === 'a'.repeat(64))).toBe(true)
    }
    finally {
      server.closeAllConnections()
      await new Promise<void>(done => server.close(() => done()))
    }
  })
})
