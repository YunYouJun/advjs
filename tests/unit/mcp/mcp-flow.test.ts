// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadProject } from '../../../packages/advjs/node/project'
import { flowDocumentRevision } from '../../../packages/core/src/project'
import { createAdvMcpServer } from '../../../packages/mcp-server/src/index'

vi.mock('@advjs/core', async importOriginal => ({
  ...await importOriginal<object>(),
  ...await import('../../../packages/core/src/project'),
}))

const path = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const content = `${JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', startNodeId: 'speech', nodes: [
  { id: 'speech', type: 'dialogues', dialogues: [{ lineId, text: 'Original', authorMetadata: { keep: true } }], next: 'end' },
  { id: 'end', type: 'end' },
] }, null, 2)}\n`

function payload(response: Awaited<ReturnType<Client['callTool']>>) {
  const text = response.content[0]
  if (!text || text.type !== 'text')
    throw new Error('Expected a JSON text response')
  const parsed = JSON.parse(text.text)
  expect(response.structuredContent).toEqual(parsed)
  return parsed
}

describe('read-only native Flow MCP tools', () => {
  let client: Client
  let directory: string
  let previousCwd: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-mcp-flow-'))
    await mkdir(join(directory, 'adv/chapters'), { recursive: true })
    await mkdir(join(directory, 'adv/settings'), { recursive: true })
    await writeFile(join(directory, 'adv.config.json'), JSON.stringify({ id: 'flow-tools', format: 'flow', root: 'adv' }))
    await writeFile(join(directory, 'adv/settings/game.json'), JSON.stringify({ title: 'Flow tools' }))
    await writeFile(join(directory, path), content)
    previousCwd = process.cwd()
    process.chdir(directory)
    const server = createAdvMcpServer({ projectLoader: loadProject })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'flow-test', version: '0.0.0' })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  })

  afterEach(async () => {
    await client.close()
    process.chdir(previousCwd)
    await rm(directory, { recursive: true, force: true })
  })

  const read = async () => payload(await client.callTool({ name: 'adv_flow_read', arguments: { path } }))
  const plan = async (request: unknown) => client.callTool({ name: 'adv_flow_plan', arguments: { request } })
  const requestFor = (snapshot: { revision: string, projectRevision: string }, commands: unknown[]) => ({
    schemaVersion: 1,
    path,
    expectedRevision: snapshot.revision,
    projectRevision: snapshot.projectRevision,
    commands,
  })

  it('exposes read-only tools and a revisioned stable-ID snapshot', async () => {
    const tools = (await client.listTools()).tools.filter(tool => tool.name.startsWith('adv_flow_'))
    expect(tools.map(tool => tool.name)).toEqual(['adv_flow_read', 'adv_flow_plan'])
    tools.forEach(tool => expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false }))
    const snapshot = await read()
    expect(snapshot).toMatchObject({ schemaVersion: 1, path, chapterId: 'intro', revision: await flowDocumentRevision(content), projectRevision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u) })
    expect(snapshot.document.nodes[0].dialogues[0].lineId).toBe(lineId)
    expect(snapshot.diagnostics).toEqual([])
  })

  it('returns a serializable request and stable-line diff without mutating any project file', async () => {
    const before = (await loadProject({ root: directory })).files
    const request = requestFor(await read(), [{ type: 'update-dialogue', nodeId: 'speech', lineId, patch: { text: 'Proposed' } }])
    const response = await plan(request)
    const planned = payload(response)
    expect(response.isError).not.toBe(true)
    expect(planned).toMatchObject({ request, path, chapterId: 'intro', valid: true, changes: { lines: [{ nodeId: 'speech', lineId, kind: 'updated', fields: ['text'] }] } })
    expect(JSON.stringify(planned)).toContain('Proposed')
    expect((await loadProject({ root: directory })).files).toEqual(before)
    expect(await readFile(join(directory, path), 'utf8')).toBe(content)
  })

  it('rejects stale chapter and dependency revisions', async () => {
    const snapshot = await read()
    const request = requestFor(snapshot, [{ type: 'set-title', title: 'Changed' }])
    await writeFile(join(directory, path), `${content} `)
    expect(payload(await plan(request)).error.code).toBe('ADV_FLOW_SOURCE_CONFLICT')
    await writeFile(join(directory, path), content)
    await writeFile(join(directory, 'adv/settings/game.json'), JSON.stringify({ title: 'Changed elsewhere' }))
    expect(payload(await plan(request)).error.code).toBe('ADV_FLOW_SOURCE_CONFLICT')
    expect(await readFile(join(directory, path), 'utf8')).toBe(content)
  })

  it('returns structured malformed, missing revision, command-limit and stable-ID errors', async () => {
    const snapshot = await read()
    const request = requestFor(snapshot, [{ type: 'set-title', title: 'Changed' }])
    const malformed: unknown[] = [
      { ...request, expectedRevision: undefined },
      { ...request, projectRevision: undefined },
      { ...request, commands: [{ type: 'update-dialogue', nodeId: 'speech', index: 0, patch: { text: 'Unsafe' } }] },
      { ...request, commands: [{ type: 'unknown-command' }] },
    ]
    for (const candidate of malformed) {
      const response = await plan(candidate)
      expect(response.isError).toBe(true)
      expect(payload(response).error.code).toBe('ADV_FLOW_PROPOSAL_INVALID')
    }
    expect(payload(await plan({ ...request, commands: Array.from({ length: 101 }, () => ({ type: 'set-title', title: 'Changed' })) })).error.code).toBe('ADV_FLOW_PROPOSAL_LIMIT')
    expect(await readFile(join(directory, path), 'utf8')).toBe(content)
  })

  it('returns compiler diagnostics for invalid plans instead of applying them', async () => {
    const response = await plan(requestFor(await read(), [{ type: 'connect', nodeId: 'speech', target: 'missing' }]))
    const planned = payload(response)
    expect(response.isError).toBe(true)
    expect(planned.valid).toBe(false)
    expect(planned.diagnostics.some((item: { severity: string }) => item.severity === 'error')).toBe(true)
    expect(await readFile(join(directory, path), 'utf8')).toBe(content)
  })

  it('reports oversized output explicitly without truncation or writes', async () => {
    const largeChapter = JSON.parse(content)
    largeChapter.nodes[0].dialogues[0].text = '长'.repeat(50000)
    const largeContent = JSON.stringify(largeChapter)
    await writeFile(join(directory, path), largeContent)
    const response = await client.callTool({ name: 'adv_flow_read', arguments: { path } })
    expect(response.isError).toBe(true)
    expect(payload(response).error).toMatchObject({ code: 'ADV_FLOW_OUTPUT_LIMIT', message: expect.stringContaining('adv flow read or adv flow plan with --json') })
    expect(await readFile(join(directory, path), 'utf8')).toBe(largeContent)

    // A chapter can fit the snapshot but exceed the before/after plan budget.
    largeChapter.nodes[0].dialogues[0].text = '长'.repeat(20000)
    const mediumContent = JSON.stringify(largeChapter)
    await writeFile(join(directory, path), mediumContent)
    const planned = await plan(requestFor(await read(), [{ type: 'set-title', title: 'Changed' }]))
    expect(planned.isError).toBe(true)
    expect(payload(planned).error.code).toBe('ADV_FLOW_OUTPUT_LIMIT')
    expect(await readFile(join(directory, path), 'utf8')).toBe(mediumContent)
  })

  it('rejects traversal, unlisted files and escaping symlinks', async () => {
    for (const unsafePath of ['../private.chapter.json', '/tmp/private.chapter.json', 'adv/chapters/../../private.chapter.json']) {
      const response = await client.callTool({ name: 'adv_flow_read', arguments: { path: unsafePath } })
      expect(response.isError).toBe(true)
      expect(payload(response).error.code).toBe('ADV_FLOW_INVALID_PATH')
    }
    await writeFile(join(directory, 'adv/chapters/hidden.chapter.json'), content.replaceAll('intro', 'hidden'))
    await writeFile(join(directory, 'adv/settings/game.json'), JSON.stringify({ chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }] }))
    const hidden = await client.callTool({ name: 'adv_flow_read', arguments: { path: 'adv/chapters/hidden.chapter.json' } })
    expect(hidden.isError).toBe(true)
    expect(payload(hidden).error.code).toBe('ADV_FLOW_SOURCE_NOT_INCLUDED')
    const external = await mkdtemp(join(tmpdir(), 'advjs-flow-external-'))
    try {
      await writeFile(join(external, 'private.chapter.json'), content)
      await symlink(join(external, 'private.chapter.json'), join(directory, 'adv/chapters/outside.chapter.json'))
      const response = await client.callTool({ name: 'adv_flow_read', arguments: { path: 'adv/chapters/outside.chapter.json' } })
      expect(response.isError).toBe(true)
      expect(payload(response).error.code).toBe('ADV_FLOW_LOAD_FAILED')
      expect(JSON.stringify(response)).not.toContain(external)
    }
    finally {
      await rm(external, { recursive: true, force: true })
    }
  })
})
