// @vitest-environment node

import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAdvMcpServer } from '../../packages/mcp-server/src/index'

function makeVp8x(width: number, height: number) {
  const bytes = Buffer.alloc(30)
  bytes.write('RIFF', 0, 'ascii')
  bytes.writeUInt32LE(22, 4)
  bytes.write('WEBP', 8, 'ascii')
  bytes.write('VP8X', 12, 'ascii')
  bytes.writeUInt32LE(10, 16)
  bytes.writeUIntLE(width - 1, 24, 3)
  bytes.writeUIntLE(height - 1, 27, 3)
  return bytes
}

function responseText(response: Awaited<ReturnType<Client['callTool']>>) {
  const first = response.content[0]
  if (!first || first.type !== 'text')
    throw new Error('Expected an MCP text response')
  return first.text
}

describe('mcp asset generation tools', () => {
  let client: Client
  let directory: string
  let previousCwd: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-mcp-assets-'))
    await mkdir(join(directory, 'adv/scenes'), { recursive: true })
    await writeFile(join(directory, 'adv.config.json'), JSON.stringify({
      id: 'mcp-assets',
      format: 'adv-md',
      root: './adv',
    }))
    await writeFile(join(directory, 'adv/scenes/library.md'), [
      '---',
      'id: library',
      'imagePrompt: A quiet library at dusk, no people, 16:9',
      '---',
      '',
    ].join('\n'))
    previousCwd = process.cwd()
    process.chdir(directory)
    const server = createAdvMcpServer()
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'asset-test', version: '0.0.0' })
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])
  })

  afterEach(async () => {
    await client.close()
    process.chdir(previousCwd)
    await rm(directory, { recursive: true, force: true })
  })

  it('requires explicit review before registering a candidate', async () => {
    const plannedResponse = await client.callTool({
      name: 'adv_asset_plan_background',
      arguments: { sceneId: 'library', width: 1536, height: 864 },
    })
    const planned = JSON.parse(responseText(plannedResponse)) as {
      taskId: string
      candidateDirectory: string
    }
    const candidatePath = `${planned.candidateDirectory}/candidate-1.webp`
    await writeFile(join(directory, candidatePath), makeVp8x(1536, 864))

    const ingestedResponse = await client.callTool({
      name: 'adv_asset_ingest_candidate',
      arguments: {
        taskId: planned.taskId,
        candidatePath,
        executor: 'codex-imagegen',
        model: 'imagegen-built-in',
      },
    })
    const ingested = JSON.parse(responseText(ingestedResponse)) as {
      candidate: { id: string }
      status: string
    }
    expect(ingested.status).toBe('generated')

    const unconfirmed = await client.callTool({
      name: 'adv_asset_accept_candidate',
      arguments: {
        taskId: planned.taskId,
        candidateId: ingested.candidate.id,
        confirm: false,
        replaceExisting: false,
      },
    })
    expect(unconfirmed.isError).toBe(true)
    expect(responseText(unconfirmed)).toContain('Explicit confirmation')

    const acceptedResponse = await client.callTool({
      name: 'adv_asset_accept_candidate',
      arguments: {
        taskId: planned.taskId,
        candidateId: ingested.candidate.id,
        confirm: true,
        replaceExisting: false,
      },
    })
    const accepted = JSON.parse(responseText(acceptedResponse)) as {
      status: string
      asset: { id: string }
      receipt: string
    }
    expect(accepted).toMatchObject({
      status: 'registered',
      asset: { id: 'background/library' },
      receipt: expect.stringContaining('/generations/'),
    })
  })
})
