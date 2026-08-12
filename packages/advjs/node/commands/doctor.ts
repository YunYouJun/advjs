import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { AdvAgentClient } from '../agent'
import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, realpath } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { version } from '../../package.json'
import { installAgentIntegration } from '../agent'
import { resolveEditorArtifactPublicRoot } from '../editor'
import { loadProject } from '../project'

export type DoctorCheckStatus = 'fail' | 'pass' | 'warn'

export interface DoctorCheck {
  id: string
  message: string
  status: DoctorCheckStatus
}

export interface RunDoctorOptions {
  client?: AdvAgentClient
  editorRoot?: string
  home?: string
  mcpArgs?: string[]
  mcpCommand?: string
  port?: number
  projectRoot?: string
  skillsRoot?: string
  toolProbe?: (command: string, args: string[]) => Promise<boolean>
}

function check(id: string, status: DoctorCheckStatus, message: string): DoctorCheck {
  return { id, message, status }
}

async function probeCommand(command: string, args: string[]) {
  return await new Promise<boolean>((resolveProbe) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: 'ignore',
    })
    const timer = setTimeout(() => child.kill('SIGTERM'), 5_000)
    child.once('error', () => {
      clearTimeout(timer)
      resolveProbe(false)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolveProbe(code === 0)
    })
  })
}

async function checkPort(port: number) {
  const server = createServer()
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolveListen)
  })
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
}

function writeMcpMessage(child: ChildProcessWithoutNullStreams, message: unknown) {
  child.stdin.write(`${JSON.stringify(message)}\n`)
}

async function mcpHandshake(command: string, args: string[], cwd: string) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  let buffer = ''
  let closed = false
  let stderr = ''
  const responses = new Map<number, unknown>()
  const waiters = new Map<number, { reject: (error: Error) => void, resolve: (value: unknown) => void }>()

  function rejectWaiters(error: Error) {
    for (const waiter of waiters.values())
      waiter.reject(error)
    waiters.clear()
  }

  child.stderr.on('data', (chunk: string) => stderr += chunk)
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) {
        try {
          const message = JSON.parse(line) as { id?: number }
          if (typeof message.id === 'number') {
            const waiter = waiters.get(message.id)
            if (waiter) {
              waiters.delete(message.id)
              waiter.resolve(message)
            }
            else {
              responses.set(message.id, message)
            }
          }
        }
        catch (error) {
          rejectWaiters(new Error(`MCP server returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`))
        }
      }
      newline = buffer.indexOf('\n')
    }
  })
  const completed = new Promise<void>((resolveClose) => {
    child.once('close', (code) => {
      closed = true
      rejectWaiters(new Error(`MCP server exited with code ${code}. ${stderr}`.trim()))
      resolveClose()
    })
  })
  child.once('error', error => rejectWaiters(error))
  child.stdin.on('error', error => rejectWaiters(error))

  async function response(id: number) {
    const existing = responses.get(id)
    if (existing)
      return existing
    return await new Promise<unknown>((resolveResponse, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(id)
        reject(new Error(`Timed out waiting for MCP response ${id}. ${stderr}`.trim()))
      }, 5_000)
      waiters.set(id, {
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
        resolve: (value) => {
          clearTimeout(timer)
          resolveResponse(value)
        },
      })
    })
  }

  try {
    writeMcpMessage(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        capabilities: {},
        clientInfo: { name: 'adv-doctor', version },
        protocolVersion: '2024-11-05',
      },
    })
    const initialized = await response(1) as { result?: { protocolVersion?: string } }
    if (!initialized.result?.protocolVersion)
      throw new Error('MCP initialize response is missing protocolVersion')
    writeMcpMessage(child, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} })
    writeMcpMessage(child, {
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/read',
      params: { uri: 'adv://project/overview' },
    })
    const resource = await response(2) as { result?: { contents?: unknown[] } }
    if (!resource.result?.contents?.length)
      throw new Error('MCP resource response is empty')
  }
  finally {
    if (!closed) {
      child.stdin.end()
      child.kill('SIGTERM')
      await completed
    }
  }
}

function nodeVersionSupported(nodeVersion: string) {
  const [major, minor] = nodeVersion.split('.').map(Number)
  return (major === 22 && minor >= 12) || major === 24
}

export async function runDoctor(options: RunDoctorOptions = {}) {
  const checks: DoctorCheck[] = []
  const projectRoot = resolve(options.projectRoot || process.cwd())
  const probe = options.toolProbe || probeCommand

  checks.push(nodeVersionSupported(process.versions.node)
    ? check('node-version', 'pass', `Node.js ${process.versions.node} is supported.`)
    : check('node-version', 'fail', `Node.js ${process.versions.node} is unsupported; install Node.js 22.12+ or 24.x.`))

  checks.push(version
    ? check('cli-package', 'pass', `advjs ${version} is installed.`)
    : check('cli-package', 'fail', 'The advjs package version could not be resolved.'))

  try {
    const canonicalRoot = await realpath(projectRoot)
    await loadProject({ root: canonicalRoot })
    checks.push(check('project-root', 'pass', `ADV.JS project found at ${canonicalRoot}.`))
  }
  catch (error) {
    checks.push(check('project-root', 'fail', `Project could not be loaded: ${error instanceof Error ? error.message : String(error)}`))
  }

  try {
    await access(projectRoot, constants.W_OK)
    checks.push(check('project-write', 'pass', 'Project root is writable.'))
  }
  catch {
    checks.push(check('project-write', 'fail', 'Project root is not writable.'))
  }

  try {
    await checkPort(options.port || 0)
    checks.push(check('editor-port', 'pass', options.port ? `Editor port ${options.port} is available.` : 'A loopback Editor port is available.'))
  }
  catch (error) {
    checks.push(check('editor-port', 'fail', `Editor port is unavailable: ${error instanceof Error ? error.message : String(error)}`))
  }

  try {
    const editorRoot = options.editorRoot || await resolveEditorArtifactPublicRoot()
    await access(join(editorRoot, 'index.html'), constants.R_OK)
    checks.push(check('editor-artifact', 'pass', `Editor artifact is readable at ${editorRoot}.`))
  }
  catch (error) {
    checks.push(check('editor-artifact', 'fail', `Editor artifact is unavailable: ${error instanceof Error ? error.message : String(error)}`))
  }

  try {
    await mcpHandshake(options.mcpCommand || 'adv-mcp-server', options.mcpArgs || [], projectRoot)
    checks.push(check('mcp-handshake', 'pass', 'MCP initialize and project resource read succeeded.'))
  }
  catch (error) {
    checks.push(check('mcp-handshake', 'fail', `MCP handshake failed: ${error instanceof Error ? error.message : String(error)}`))
  }

  try {
    const status = await installAgentIntegration({
      client: options.client || 'codex',
      dryRun: true,
      home: options.home,
      mcp: true,
      skills: 'default',
      skillsRoot: options.skillsRoot,
    })
    checks.push(status.changed
      ? check('agent-installation', 'warn', `Run adv agent install --client ${status.client} --skills default --mcp to repair Agent integration.`)
      : check('agent-installation', 'pass', `${status.client} Skills and MCP configuration match the package catalog.`))
  }
  catch (error) {
    checks.push(check('agent-installation', 'warn', `Agent integration could not be verified: ${error instanceof Error ? error.message : String(error)}`))
  }

  const wrangler = await probe('wrangler', ['whoami'])
  checks.push(wrangler
    ? check('optional-cloudflare', 'pass', 'Wrangler is installed and authenticated.')
    : check('optional-cloudflare', 'warn', 'Cloudflare deployment is optional; install Wrangler and run wrangler login before deploying.'))
  const imageTool = await probe('magick', ['-version'])
  checks.push(imageTool
    ? check('optional-image-tool', 'pass', 'ImageMagick is available for optional asset processing.')
    : check('optional-image-tool', 'warn', 'ImageMagick is optional; install it to enable local image processing workflows.'))
  const audioTool = await probe('ffmpeg', ['-version'])
  checks.push(audioTool
    ? check('optional-audio-tool', 'pass', 'FFmpeg is available for optional audio/video processing.')
    : check('optional-audio-tool', 'warn', 'FFmpeg is optional; install it to enable local audio and video workflows.'))

  return { checks }
}
