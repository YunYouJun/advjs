// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Script } from 'node:vm'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAdvMcpServer } from '../../packages/mcp-server/src/index'

describe('mcp workspace app', () => {
  let client: Client
  let directory: string
  let previousCwd: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-mcp-workspace-'))
    await mkdir(join(directory, 'adv/chapters'), { recursive: true })
    await writeFile(join(directory, 'adv.config.json'), JSON.stringify({
      id: 'workspace-demo',
      format: 'adv-md',
      root: './adv',
    }))
    await writeFile(join(directory, 'adv/chapters/intro.adv.md'), [
      '---',
      'title: Intro',
      '---',
      '',
      '> A quiet beginning.',
      '',
    ].join('\n'))

    previousCwd = process.cwd()
    process.chdir(directory)

    const server = createAdvMcpServer()
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'workspace-app-test', version: '0.0.0' })
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

  it('advertises the MCP Apps resource on the workspace tool', async () => {
    const tools = await client.listTools()
    const tool = tools.tools.find(item => item.name === 'advjs_show_project_workspace')

    expect(tool?._meta).toMatchObject({
      ui: { resourceUri: 'ui://advjs/workspace.html' },
    })

    const resource = await client.readResource({ uri: 'ui://advjs/workspace.html' })
    expect(resource.contents[0]).toMatchObject({
      mimeType: 'text/html;profile=mcp-app',
    })
    expect((resource.contents[0] as { text: string }).text).toContain('Command approval required')
  })

  it('returns structured project context with a command awaiting approval', async () => {
    const response = await client.callTool({
      name: 'advjs_show_project_workspace',
      arguments: {},
    })
    const snapshot = response.structuredContent as {
      project: { id: string, chapters: number }
      command: { command: string, status: string }
      task: { status: string }
    }

    expect(snapshot).toMatchObject({
      project: { id: 'workspace-demo', chapters: 1 },
      command: { command: 'pnpm adv check', status: 'awaiting_approval' },
      task: { status: 'ready' },
    })
  })

  it('initializes the served UI and renders host tool results', async () => {
    const resource = await client.readResource({ uri: 'ui://advjs/workspace.html' })
    const dom = new JSDOM((resource.contents[0] as { text: string }).text, { runScripts: 'outside-only' })
    try {
      const script = dom.window.document.querySelector('script')!.textContent!
      const requests: any[] = []
      dom.window.parent.postMessage = (message: any) => requests.push(message)
      new Script(script).runInContext(dom.getInternalVMContext())
      const initialize = requests.find(message => message.method === 'ui/initialize')
      expect(initialize).toBeDefined()
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        source: dom.window,
        data: { jsonrpc: '2.0', id: initialize.id, result: { protocolVersion: '2026-01-26', hostCapabilities: {} } },
      }))
      await Promise.resolve()
      expect(requests.some(message => message.method === 'ui/notifications/initialized')).toBe(true)

      const result = await client.callTool({ name: 'advjs_show_project_workspace', arguments: {} })
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        source: dom.window,
        data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result },
      }))
      expect(dom.window.document.getElementById('stats')!.textContent).toContain('Chapters: 1')
      expect(dom.window.document.getElementById('logs')!.textContent).toContain('Project metadata loaded\nValidation command prepared')
      expect((dom.window.document.getElementById('run-button') as HTMLButtonElement).disabled).toBe(false)
      expect(requests.some(message => message.method === 'tools/call')).toBe(false)
      dom.window.document.getElementById('run-button')!.click()
      await Promise.resolve()
      const check = requests.find(message => message.method === 'tools/call')
      expect(check.params.name).toBe('advjs_run_project_check')
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        source: dom.window,
        data: { jsonrpc: '2.0', id: check.id, error: { message: 'Validator unavailable' } },
      }))
      await Promise.resolve()
      await Promise.resolve()
      expect(dom.window.document.getElementById('logs')!.textContent).toContain('Validator unavailable')
    }
    finally {
      await Promise.resolve()
      dom.window.close()
    }
  })

  it('shows initialization errors and keeps command execution disabled', async () => {
    const resource = await client.readResource({ uri: 'ui://advjs/workspace.html' })
    const dom = new JSDOM((resource.contents[0] as { text: string }).text, { runScripts: 'outside-only' })
    try {
      const requests: any[] = []
      dom.window.parent.postMessage = (message: any) => requests.push(message)
      new Script(dom.window.document.querySelector('script')!.textContent!).runInContext(dom.getInternalVMContext())
      const initialize = requests.find(message => message.method === 'ui/initialize')
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        source: dom.window,
        data: { jsonrpc: '2.0', id: initialize.id, error: { message: 'Unsupported protocol' } },
      }))
      await Promise.resolve()
      await Promise.resolve()
      expect(dom.window.document.getElementById('connection-status')!.textContent).toBe('Connection failed')
      expect(dom.window.document.getElementById('logs')!.textContent).toContain('Unsupported protocol')
      expect((dom.window.document.getElementById('run-button') as HTMLButtonElement).disabled).toBe(true)
      expect(requests.some(message => message.method === 'tools/call')).toBe(false)
    }
    finally {
      await Promise.resolve()
      dom.window.close()
    }
  })

  it('runs the real project validator and updates the task result', async () => {
    const response = await client.callTool({
      name: 'advjs_run_project_check',
      arguments: {},
    })
    const snapshot = response.structuredContent as {
      command: { status: string }
      task: { status: string, logs: string[] }
    }

    expect(snapshot.command.status).toBe('passed')
    expect(snapshot.task.status).toBe('passed')
    expect(snapshot.task.logs).toContain('All checks passed')
  })
})
