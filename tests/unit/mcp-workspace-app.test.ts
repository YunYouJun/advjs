// @vitest-environment node
import type { AdvWorkspaceSnapshot } from '../../packages/mcp-server/src/workspace-app'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Script } from 'node:vm'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAdvWorkspaceApp } from '../../packages/mcp-server/src/workspace-app'

async function flush() {
  for (let i = 0; i < 8; i++)
    await Promise.resolve()
}

describe('mCP workspace app', () => {
  let client: Client
  let server: McpServer
  let directory: string
  let runCheck: ReturnType<typeof vi.fn>
  let dom: JSDOM | undefined
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-workspace-'))
    runCheck = vi.fn(async () => ({ passed: true, scriptCount: 1, characterRefCount: 3, sceneRefCount: 1, issues: [] }))
    server = new McpServer({ name: 'workspace-test', version: '0.0.0' })
    registerAdvWorkspaceApp(server, {
      cwd: directory,
      runCheck,
      projectLoader: async () => ({
        root: directory,
        files: { 'adv/chapters/intro.adv.md': '> Intro', 'adv.config.json': '{}' },
        result: { diagnostics: [], project: { id: 'three-kingdoms', chapters: [{}], characters: [{}, {}, {}], scenes: [{}] } },
      }),
    })
    const [a, b] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'workspace-test', version: '0.0.0' })
    await Promise.all([client.connect(a), server.connect(b)])
  })
  afterEach(async () => {
    dom?.window.close()
    dom = undefined
    await Promise.all([client.close(), server.close()])
    await rm(directory, { recursive: true, force: true })
  })

  const call = (name = 'advjs_show_project_workspace', locale = 'zh-CN') => client.callTool({ name, arguments: { locale } })
  async function ui(options: { browser?: string, saved?: string, noStorage?: boolean } = {}) {
    const resource = await client.readResource({ uri: 'ui://advjs/workspace.html' })
    dom = new JSDOM((resource.contents[0] as { text: string }).text, { runScripts: 'outside-only', url: 'https://workspace.test' })
    const window = dom.window
    Object.defineProperty(window.navigator, 'languages', { value: [options.browser ?? 'en-US'] })
    if (options.saved)
      window.localStorage.setItem('advjs-workspace-locale', options.saved)
    if (options.noStorage)
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked') } })
    const requests: any[] = []
    window.parent.postMessage = (message: any) => requests.push(message)
    new Script(window.document.querySelector('script')!.textContent!).runInContext(dom.getInternalVMContext())
    const send = (message: any) => window.dispatchEvent(new window.MessageEvent('message', { source: window, data: { jsonrpc: '2.0', ...message } }))
    const initialize = async (context = {}) => {
      send({ id: requests.findLast(m => m.method === 'ui/initialize').id, result: { hostContext: context } })
      await flush()
    }
    const result = await call()
    send({ method: 'ui/notifications/tool-result', params: result })
    const get = (id: string) => window.document.getElementById(id)!
    const change = (value: string) => {
      (get('language') as HTMLSelectElement).value = value
      get('language').dispatchEvent(new window.Event('change'))
    }
    return { get, requests, send, initialize, change, window, result }
  }

  it('reports the correct project in Chinese without running checks or inventing approval state', async () => {
    const result = await call()
    expect(result.structuredContent).toMatchObject({
      project: { id: 'three-kingdoms', characters: 3, root: directory, branch: '' },
      validation: { status: 'not_run', issues: [] },
    })
    expect(result.content).toEqual([expect.objectContaining({ text: expect.stringContaining('尚未运行') })])
    const data = result.structuredContent as AdvWorkspaceSnapshot
    expect(data.command.command).toContain('adv.mjs\' check --json')
    expect(data.command.cwd).toBe(directory)
    expect(runCheck).not.toHaveBeenCalled()
    expect(data).not.toHaveProperty('task')
    expect(data.command).not.toHaveProperty('status')
  })

  it('preserves actual validation issues on refresh and allows another check', async () => {
    runCheck.mockResolvedValueOnce({ passed: false, scriptCount: 1, characterRefCount: 1, sceneRefCount: 0, issues: [{ type: 'error', category: 'character', file: 'intro.adv.md', message: 'Unknown character' }] })
    const checked = await call('advjs_run_project_check')
    expect(checked.structuredContent).toMatchObject({ diagnostics: { errors: 0 }, validation: { status: 'failed', issues: [{ message: 'Unknown character', severity: 'error' }] } })
    const refreshed = await call()
    expect(refreshed.structuredContent?.validation).toEqual(checked.structuredContent?.validation)
    expect((await call('advjs_run_project_check')).structuredContent?.validation).toMatchObject({ status: 'passed', issues: [] })
    expect(runCheck).toHaveBeenCalledTimes(2)
  })

  it('coalesces simultaneous checks', async () => {
    let release!: () => void
    runCheck.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return { passed: true, scriptCount: 1, characterRefCount: 0, sceneRefCount: 0, issues: [] }
    })
    const a = call('advjs_run_project_check')
    const b = call('advjs_run_project_check')
    await vi.waitFor(() => expect(runCheck).toHaveBeenCalledTimes(1))
    release()
    await Promise.all([a, b])
    expect(runCheck).toHaveBeenCalledTimes(1)
  })

  it('runs the real read-only validator against a temporary fixture', async () => {
    await mkdir(join(directory, 'adv/chapters'), { recursive: true })
    await writeFile(join(directory, 'adv.config.json'), JSON.stringify({ id: 'fixture', format: 'adv-md', root: './adv' }))
    await writeFile(join(directory, 'adv/chapters/intro.adv.md'), '---\ntitle: Intro\n---\n\n> A quiet beginning.\n')
    runCheck.mockImplementationOnce(async () => (await import('advjs')).runCheck({ cwd: directory }))
    const result = await call('advjs_run_project_check')
    expect(result.isError).not.toBe(true)
    expect(result.structuredContent?.validation).toMatchObject({ status: 'passed', scriptCount: 1 })
  })

  it('advertises the app resource and localizes from host context', async () => {
    const tools = await client.listTools()
    expect(tools.tools.find(t => t.name === 'advjs_show_project_workspace')?._meta).toMatchObject({ ui: { resourceUri: 'ui://advjs/workspace.html' } })
    const app = await ui()
    await app.initialize({ locale: 'zh-TW', theme: 'dark' })
    expect(app.window.document.documentElement.lang).toBe('zh-CN')
    expect(app.window.document.documentElement.dataset.theme).toBe('dark')
    expect(app.get('stats').textContent).toContain('3人物')
    expect(app.get('validation-status').textContent).toBe('尚未运行校验')
    expect(app.get('files').closest('details')!.open).toBe(false)
    expect(app.window.document.querySelector('.progress')).toBeNull()
    expect(app.requests.filter(m => m.method === 'tools/call')).toHaveLength(0)
  })

  it('persists manual language and follows host changes only in auto mode', async () => {
    const app = await ui({ saved: 'en' })
    await app.initialize({ locale: 'zh-CN' })
    expect(app.get('run').textContent).toBe('Check project')
    app.change('zh-CN')
    app.send({ method: 'ui/notifications/host-context-changed', params: { locale: 'en-GB', theme: 'light' } })
    expect(app.get('run').textContent).toBe('校验项目')
    expect(app.window.localStorage.getItem('advjs-workspace-locale')).toBe('zh-CN')
    app.change('auto')
    expect(app.get('run').textContent).toBe('Check project')
    expect(app.window.document.documentElement.dataset.theme).toBe('light')
  })

  it('falls back to browser language even when iframe storage is unavailable', async () => {
    const app = await ui({ browser: 'zh-Hans-CN', noStorage: true })
    await app.initialize()
    expect(app.get('run').textContent).toBe('校验项目')
    app.change('en')
    expect(app.get('run').textContent).toBe('Check project')
  })

  it('disables competing actions while checking and handles tool errors with retry', async () => {
    const app = await ui()
    await app.initialize({ locale: 'zh-CN' })
    app.get('run').click()
    expect((app.get('run') as HTMLButtonElement).disabled).toBe(true)
    expect((app.get('refresh') as HTMLButtonElement).disabled).toBe(true)
    const request = app.requests.findLast(m => m.method === 'tools/call')
    expect(request.params).toEqual({ name: 'advjs_run_project_check', arguments: { locale: 'zh-CN' } })
    app.send({ id: request.id, result: { isError: true, content: [{ type: 'text', text: 'Validator unavailable' }] } })
    await flush()
    expect(app.get('error').textContent).toContain('Validator unavailable')
    expect((app.get('run') as HTMLButtonElement).disabled).toBe(false)
    app.get('run').click()
    const retry = app.requests.findLast(m => m.method === 'tools/call')
    app.send({ id: retry.id, result: await call('advjs_run_project_check') })
    await flush()
    expect(app.get('error').hidden).toBe(true)
    expect(app.get('validation-status').textContent).toBe('上次校验通过')
  })

  it('shows bridge errors, supports reconnection and rejects unrelated window messages', async () => {
    const app = await ui()
    app.window.dispatchEvent(new app.window.MessageEvent('message', { source: null, data: { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { locale: 'zh-CN' } } }))
    expect(app.window.document.documentElement.lang).toBe('en')
    app.send({ id: app.requests[0].id, error: { message: 'Unsupported protocol' } })
    await flush()
    expect(app.get('error').textContent).toContain('Unsupported protocol')
    expect((app.get('run') as HTMLButtonElement).disabled).toBe(true)
    app.get('refresh').click()
    await app.initialize()
    const refresh = app.requests.findLast(m => m.method === 'tools/call')
    app.send({ id: refresh.id, result: app.result })
    await flush()
    expect((app.get('run') as HTMLButtonElement).disabled).toBe(false)
    expect(app.get('error').hidden).toBe(true)
  })
})
