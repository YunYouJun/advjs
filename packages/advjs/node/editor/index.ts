import type { AdvAgentIntegrationStatus } from '@advjs/types'
import type { FSWatcher } from 'node:fs'
import type { Server, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { watch } from 'node:fs'
import {
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'pathe'

export type EditorBridgeCommand = 'build' | 'check'

export interface EditorBridgeOptions {
  host?: string
  port?: number
  projectRoot: string
  publicRoot?: string
  runCommand?: (command: EditorBridgeCommand) => Promise<unknown>
  getAgentStatus?: () => Promise<AdvAgentIntegrationStatus>
}

export interface EditorBridgeReadyEvent {
  event: 'ready'
  root: string
  url: string
}

export interface EditorBridgeStoppedEvent {
  event: 'stopped'
}

export interface EditorBridge {
  readonly projectRoot: string
  readonly started: boolean
  readonly token: string
  start: () => Promise<EditorBridgeReadyEvent>
  stop: () => Promise<EditorBridgeStoppedEvent>
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const API_PREFIX = '/__advjs/api/'
const MAX_WRITE_BYTES = 8 * 1024 * 1024
const SECURITY_HEADERS = {
  'content-security-policy': [
    'default-src \'self\' data: blob:',
    'base-uri \'self\'',
    'connect-src \'self\' data: blob:',
    'font-src \'self\' data:',
    'frame-ancestors \'none\'',
    'img-src \'self\' data: blob: https:',
    'media-src \'self\' data: blob: https:',
    'object-src \'none\'',
    'script-src \'self\' \'unsafe-eval\' \'unsafe-inline\' blob:',
    'style-src \'self\' \'unsafe-inline\'',
    'worker-src \'self\' blob:',
  ].join('; '),
  'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
} as const
const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
}

class EditorHttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export class EditorBridgeError extends Error {
  readonly code = 'ADV_EDITOR'

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'EditorBridgeError'
  }
}

function isWithinRoot(root: string, target: string) {
  const path = relative(root, target)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

function normalizeProjectPath(path: string | null) {
  if (!path || path.includes('\0'))
    throw new EditorHttpError(400, 'A project-relative path is required')
  const slashPath = path.replaceAll('\\', '/')
  if (slashPath.startsWith('/') || /^[a-z]:\//iu.test(slashPath))
    throw new EditorHttpError(400, 'Absolute paths are not allowed')
  const segments = slashPath.split('/').filter(segment => segment && segment !== '.')
  if (segments.length === 0 || segments.includes('..'))
    throw new EditorHttpError(400, 'Path traversal is not allowed')
  return segments.join('/')
}

async function resolveSafeProjectFile(root: string, path: string, forWrite = false) {
  const normalized = normalizeProjectPath(path)
  const logicalPath = resolve(root, normalized)
  if (!isWithinRoot(root, logicalPath))
    throw new EditorHttpError(400, 'Path traversal is not allowed')

  try {
    const target = await realpath(logicalPath)
    if (!isWithinRoot(root, target))
      throw new EditorHttpError(403, 'Project symlink escapes the workspace root')
    if (!(await stat(target)).isFile())
      throw new EditorHttpError(400, 'Project path is not a file')
    return { normalized, target }
  }
  catch (error) {
    if (error instanceof EditorHttpError)
      throw error
    if (!forWrite)
      throw new EditorHttpError(404, `Project file not found: ${normalized}`)
    const parent = await realpath(dirname(logicalPath)).catch(() => undefined)
    if (!parent || !isWithinRoot(root, parent))
      throw new EditorHttpError(403, 'Project file parent escapes the workspace root')
    return { normalized, target: logicalPath }
  }
}

function writeJson(response: ServerResponse, statusCode: number, value: unknown) {
  const body = `${JSON.stringify(value)}\n`
  response.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(body)
}

async function readRequestBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > MAX_WRITE_BYTES)
      throw new EditorHttpError(413, 'Editor file write exceeds the size limit')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function tokenMatches(actual: string | undefined, expected: string) {
  if (!actual?.startsWith('Bearer '))
    return false
  const provided = Buffer.from(actual.slice('Bearer '.length))
  const target = Buffer.from(expected)
  return provided.length === target.length && timingSafeEqual(provided, target)
}

export async function resolveEditorArtifactPublicRoot() {
  const require = createRequire(import.meta.url)
  try {
    const packageJson = require.resolve('@advjs/editor/package.json')
    return await realpath(resolve(dirname(packageJson), 'dist'))
  }
  catch (error) {
    throw new EditorBridgeError(
      'The @advjs/editor artifact is unavailable. Reinstall advjs with its runtime dependencies.',
      { cause: error },
    )
  }
}

async function defaultRunCommand(command: EditorBridgeCommand, projectRoot: string) {
  if (command === 'check') {
    const { runCheck } = await import('../commands/check')
    return await runCheck({ cwd: projectRoot })
  }
  const { advBuild } = await import('../commands/build')
  return await advBuild({ userRoot: projectRoot })
}

async function defaultAgentStatus(projectRoot: string): Promise<AdvAgentIntegrationStatus> {
  const { installAgentIntegration } = await import('../agent')
  const result = await installAgentIntegration({
    client: 'codex',
    dryRun: true,
    mcp: true,
    skills: 'default',
  })
  const configOperation = result.diff.find(operation => operation.path === result.configPath)
  const skillOperations = result.diff.filter(operation => operation.path !== result.configPath)
  const skillsReady = skillOperations.every(operation => operation.kind === 'unchanged')
  const mcpReady = configOperation?.kind === 'unchanged'
  return {
    client: 'codex',
    ready: skillsReady && mcpReady,
    checks: [
      {
        id: 'skills',
        status: skillsReady ? 'pass' : 'repair',
        message: skillsReady ? 'ADV.JS default Skills are current.' : 'ADV.JS default Skills need installation or refresh.',
      },
      {
        id: 'mcp',
        status: mcpReady ? 'pass' : 'repair',
        message: mcpReady ? 'The ADV.JS MCP server is configured for Codex.' : 'The ADV.JS MCP configuration needs installation or refresh.',
      },
    ],
    installCommand: 'adv agent install --client codex --skills default --mcp',
    doctorCommand: `adv doctor ${JSON.stringify(projectRoot)} --client codex`,
  }
}

export async function createEditorBridge(options: EditorBridgeOptions): Promise<EditorBridge> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 3000
  if (!LOOPBACK_HOSTS.has(host))
    throw new EditorBridgeError(`Editor host must be loopback-only: ${host}`)
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new EditorBridgeError(`Invalid Editor port: ${port}`)

  const projectRoot = await realpath(resolve(options.projectRoot)).catch((error) => {
    throw new EditorBridgeError(`Invalid Editor project root: ${options.projectRoot}`, { cause: error })
  })
  if (!(await stat(projectRoot)).isDirectory())
    throw new EditorBridgeError(`Editor project root is not a directory: ${projectRoot}`)
  const publicRoot = options.publicRoot
    ? await realpath(resolve(options.publicRoot))
    : await resolveEditorArtifactPublicRoot()
  const indexFile = resolve(publicRoot, 'index.html')
  if (!(await stat(indexFile).catch(() => undefined))?.isFile())
    throw new EditorBridgeError(`Editor artifact is missing index.html: ${publicRoot}`)

  let token = randomBytes(32).toString('base64url')
  let server: Server | undefined
  let watcher: FSWatcher | undefined
  let editorOrigin = ''
  const eventResponses = new Set<ServerResponse>()

  async function runCommand(command: EditorBridgeCommand) {
    return options.runCommand
      ? await options.runCommand(command)
      : await defaultRunCommand(command, projectRoot)
  }

  async function handleApi(
    request: import('node:http').IncomingMessage,
    response: ServerResponse,
    url: URL,
  ) {
    if (request.headers.host !== new URL(editorOrigin).host)
      throw new EditorHttpError(403, 'Editor request host is not allowed')
    if (request.headers.origin && request.headers.origin !== editorOrigin)
      throw new EditorHttpError(403, 'Editor request origin is not allowed')
    if (!tokenMatches(request.headers.authorization, token))
      throw new EditorHttpError(401, 'Editor session token is required')

    const apiPath = decodeURIComponent(url.pathname.slice(API_PREFIX.length))
    if (apiPath === 'file' && request.method === 'GET') {
      const { normalized, target } = await resolveSafeProjectFile(projectRoot, url.searchParams.get('path') ?? '')
      const body = await readFile(target)
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'cache-control': 'no-store',
        'content-length': body.byteLength,
        'content-type': 'text/plain; charset=utf-8',
        'x-advjs-project-path': encodeURIComponent(normalized),
      })
      response.end(body)
      return
    }
    if (apiPath === 'asset' && request.method === 'GET') {
      const { normalized, target } = await resolveSafeProjectFile(projectRoot, url.searchParams.get('path') ?? '')
      const body = await readFile(target)
      const contentType = MIME_TYPES[extname(target)]
      if (!contentType?.startsWith('image/'))
        throw new EditorHttpError(415, `Editor preview does not support this asset type: ${normalized}`)
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'cache-control': 'no-store',
        'content-length': body.byteLength,
        'content-type': contentType,
        'x-advjs-project-path': encodeURIComponent(normalized),
      })
      response.end(body)
      return
    }
    if (apiPath === 'file' && request.method === 'PUT') {
      const { normalized, target } = await resolveSafeProjectFile(projectRoot, url.searchParams.get('path') ?? '', true)
      const body = await readRequestBody(request)
      const temporaryFile = resolve(dirname(target), `.advjs-write-${randomUUID()}`)
      await writeFile(temporaryFile, body, { encoding: 'utf8', flag: 'wx' })
      await rename(temporaryFile, target)
      writeJson(response, 200, {
        bytes: Buffer.byteLength(body),
        path: normalized,
        sha256: createHash('sha256').update(body).digest('hex'),
      })
      return
    }
    if (apiPath === 'project' && request.method === 'GET') {
      const { loadProject } = await import('../project')
      const project = await loadProject({ root: projectRoot })
      writeJson(response, 200, {
        config: project.config,
        files: project.files,
        result: project.result,
        root: project.root,
      })
      return
    }
    if (apiPath === 'agent/codex' && request.method === 'GET') {
      writeJson(response, 200, await (options.getAgentStatus
        ? options.getAgentStatus()
        : defaultAgentStatus(projectRoot)))
      return
    }
    if (apiPath === 'events' && request.method === 'GET') {
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'cache-control': 'no-store',
        'connection': 'keep-alive',
        'content-type': 'text/event-stream; charset=utf-8',
      })
      response.write(': connected\n\n')
      eventResponses.add(response)
      request.once('close', () => eventResponses.delete(response))
      return
    }
    const command = apiPath.startsWith('commands/') ? apiPath.slice('commands/'.length) : ''
    if (request.method === 'POST' && (command === 'check' || command === 'build')) {
      writeJson(response, 200, await runCommand(command))
      return
    }
    throw new EditorHttpError(404, 'Editor API endpoint not found')
  }

  async function serveStatic(request: import('node:http').IncomingMessage, response: ServerResponse, url: URL) {
    if (request.method !== 'GET' && request.method !== 'HEAD')
      throw new EditorHttpError(405, 'Method not allowed')
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
    const logicalPath = resolve(publicRoot, pathname)
    let target = indexFile
    if (isWithinRoot(publicRoot, logicalPath)) {
      const candidate = await realpath(logicalPath).catch(() => undefined)
      if (candidate && isWithinRoot(publicRoot, candidate) && (await stat(candidate)).isFile())
        target = candidate
    }
    const body = await readFile(target)
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'cache-control': target === indexFile ? 'no-cache' : 'public, max-age=31536000, immutable',
      'content-length': body.byteLength,
      'content-type': MIME_TYPES[extname(target)] ?? 'application/octet-stream',
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  }

  return {
    projectRoot,
    get started() {
      return Boolean(server?.listening)
    },
    get token() {
      return token
    },
    async start() {
      if (server?.listening)
        throw new EditorBridgeError('Editor bridge is already started')

      token = randomBytes(32).toString('base64url')
      const nextServer = createServer(async (request, response) => {
        try {
          const url = new URL(request.url ?? '/', editorOrigin || `http://${host}`)
          if (url.pathname.startsWith(API_PREFIX))
            await handleApi(request, response, url)
          else
            await serveStatic(request, response, url)
        }
        catch (error) {
          const statusCode = error instanceof EditorHttpError ? error.statusCode : 500
          writeJson(response, statusCode, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })

      try {
        await new Promise<void>((resolveListen, reject) => {
          nextServer.once('error', reject)
          nextServer.listen(port, host, resolveListen)
        })
        const address = nextServer.address()
        const actualPort = address && typeof address !== 'string' ? address.port : port
        const urlHost = host === '::1' ? '[::1]' : host
        editorOrigin = `http://${urlHost}:${actualPort}`
        watcher = watch(projectRoot, { recursive: true }, (eventType, filename) => {
          const data = JSON.stringify({ event: eventType, path: filename?.toString().replaceAll('\\', '/') ?? '' })
          for (const eventResponse of eventResponses)
            eventResponse.write(`event: change\ndata: ${data}\n\n`)
        })
        watcher.once('error', () => {})
        server = nextServer
        return {
          event: 'ready',
          root: projectRoot,
          url: `${editorOrigin}/#advjs-token=${encodeURIComponent(token)}`,
        }
      }
      catch (error) {
        nextServer.close()
        throw new EditorBridgeError(
          `Editor bridge failed to listen on ${host}:${port}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        )
      }
    },
    async stop() {
      watcher?.close()
      watcher = undefined
      for (const response of eventResponses)
        response.end()
      eventResponses.clear()
      const activeServer = server
      server = undefined
      if (activeServer) {
        await new Promise<void>((resolveClose, reject) => {
          activeServer.close(error => error ? reject(error) : resolveClose())
          activeServer.closeIdleConnections()
        }).catch((error) => {
          throw new EditorBridgeError('Editor bridge failed to stop', { cause: error })
        })
      }
      editorOrigin = ''
      return { event: 'stopped' }
    },
  }
}
