// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadProject } from '../../packages/advjs/node/project'
import { createAdvMcpServer } from '../../packages/mcp-server/src/index'

// End-to-end coverage for the branches/coverage MCP resources: wires a real
// MCP client to the server over an in-memory transport and reads resources,
// exercising URI parsing + chapter resolution + the analysis pipeline.

const CHAPTER = `---
plotSummary: 测试章
---

【学校，白天，内景】

@艾莉亚
你好。

- 去图书馆
- 去天台
`

describe('mcp branches/coverage resources', () => {
  let dir: string
  let prevCwd: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'advjs-mcp-res-'))
    const chapters = join(dir, 'adv', 'chapters')
    mkdirSync(chapters, { recursive: true })
    writeFileSync(join(dir, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv' }), 'utf-8')
    writeFileSync(join(chapters, 'ch01.adv.md'), CHAPTER, 'utf-8')
    // The server resolves gameRoot from cwd → <cwd>/adv.
    prevCwd = process.cwd()
    process.chdir(dir)
  })

  afterAll(() => {
    process.chdir(prevCwd)
    rmSync(dir, { recursive: true, force: true })
  })

  async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const server = createAdvMcpServer({ projectLoader: loadProject })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test', version: '0.0.0' })
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])
    try {
      return await fn(client)
    }
    finally {
      await client.close()
    }
  }

  it('exposes adv://branches/{id} with a graph payload', async () => {
    const text = await withClient(async (client) => {
      const res = await client.readResource({ uri: 'adv://branches/ch01' })
      return (res.contents[0] as { text: string }).text
    })
    const graph = JSON.parse(text)
    expect(graph.chapter).toBe('ch01')
    expect(Array.isArray(graph.nodes)).toBe(true)
    expect(Array.isArray(graph.edges)).toBe(true)
    expect(graph.nodes.some((n: any) => n.kind === 'choices')).toBe(true)
  })

  it('exposes adv://coverage/{id} with a coverage report', async () => {
    const text = await withClient(async (client) => {
      const res = await client.readResource({ uri: 'adv://coverage/ch01' })
      return (res.contents[0] as { text: string }).text
    })
    const report = JSON.parse(text)
    expect(report.chapter).toBe('ch01')
    expect(report.choicePoints).toBe(1)
    expect(report.totalOptions).toBe(2)
    expect(typeof report.distinctPaths).toBe('number')
  })

  it('returns a not-found message for an unknown chapter', async () => {
    const text = await withClient(async (client) => {
      const res = await client.readResource({ uri: 'adv://coverage/does-not-exist' })
      return (res.contents[0] as { text: string }).text
    })
    expect(text).toContain('not found')
  })

  it('exposes the same normalized compiler result used by the Node project loader', async () => {
    const expected = await loadProject({ root: dir })
    const compiled = await withClient(async (client) => {
      const res = await client.readResource({ uri: 'adv://project/compiled' })
      return JSON.parse((res.contents[0] as { text: string }).text)
    })

    expect(compiled).toEqual(expected.result)
  })
})
