import type { IncomingMessage, ServerResponse } from 'node:http'
import type { EditorRepository } from './host-protocol.ts'
import { Buffer } from 'node:buffer'
import { randomBytes, randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { EDITOR_PROJECT_HOST_PATH, EDITOR_PROJECT_HOST_VERSION } from './host-protocol.ts'

export type EditorHostHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>
export interface EditorProjectHostAdapter {
  id: string
  title: string
  apiPrefix: string
  /** Canonicalize and validate using trusted host code, never code from the selected project. */
  inspect: (path: unknown) => Promise<EditorRepository>
  open: (repository: EditorRepository, lease: { id: string, validateAccess: () => Promise<void> }) => EditorHostHandler | Promise<EditorHostHandler>
  /** Revalidate paths before every transaction and immediately before committing writes. */
  validateAccess: (repository: EditorRepository) => Promise<void>
}
function failure(status: number, message: string) {
  return Object.assign(new Error(message), { status })
}
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(body))
}
/** Finite authenticated control + immutable per-window leases. No file-format or UI knowledge. */
export async function createEditorProjectHost(adapter: EditorProjectHostAdapter, initialPath: string) {
  if (!/^[a-z][a-z0-9.-]*$/u.test(adapter.id) || !/^\/api\/[a-z][a-z0-9-]*$/u.test(adapter.apiPrefix))
    throw new Error('Invalid project host adapter identity or API prefix')
  function repository(value: EditorRepository) {
    if (!isAbsolute(value.root) || !value.name)
      throw new Error('Project host adapter must return a canonical absolute repository')
    return value
  }
  const initial = repository(await adapter.inspect(initialPath))
  const controlToken = randomBytes(32).toString('hex')
  const sessions = new Map<string, { id: string, api?: EditorHostHandler }>()
  let disposed = false
  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (req.url !== EDITOR_PROJECT_HOST_PATH)
      return false
    try {
      if (disposed || req.method !== 'POST' || req.headers['x-advjs-workspace-token'] !== controlToken || req.headers.origin
        || !/^(?:127\.0\.0\.1|localhost):\d+$/u.test(req.headers.host ?? '')) {
        throw failure(403, 'Invalid project host session')
      }
      req.setEncoding('utf8')
      let text = ''
      for await (const part of req) {
        text += part
        if (Buffer.byteLength(text) > 16384)
          throw failure(413, 'Project host request is too large')
      }
      let body: any
      try {
        body = JSON.parse(text)
      }
      catch { throw failure(400, 'Invalid project host request') }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw failure(400, 'Invalid project host request')
      if (body.operation === 'info') {
        send(res, 200, { apiVersion: EDITOR_PROJECT_HOST_VERSION, id: adapter.id, title: adapter.title, defaultRoot: initial.root })
      }
      else if (body.operation === 'inspect') {
        send(res, 200, repository(await adapter.inspect(body.path)))
      }
      else if (body.operation === 'open') {
        const repo = repository(await adapter.inspect(body.path))
        const id = randomUUID()
        const apiToken = randomBytes(32).toString('hex')
        if (disposed)
          throw failure(410, 'Project host has closed')
        const session: { id: string, api?: EditorHostHandler } = { id }
        sessions.set(apiToken, session)
        const validateAccess = async () => {
          if (disposed || sessions.get(apiToken) !== session)
            throw failure(410, 'Repository session has ended')
          await adapter.validateAccess(repo)
          if (disposed || sessions.get(apiToken) !== session)
            throw failure(410, 'Repository session has ended')
        }
        try {
          session.api = await adapter.open(repo, { id, validateAccess })
          await validateAccess()
        }
        catch (error) {
          sessions.delete(apiToken)
          throw error
        }
        send(res, 200, { ...repo, id, apiToken })
      }
      else if (body.operation === 'release' && typeof body.id === 'string') {
        for (const [token, session] of sessions) {
          if (session.id === body.id)
            sessions.delete(token)
        }
        send(res, 200, {})
      }
      else {
        throw failure(400, 'Unknown project host operation')
      }
    }
    catch (error) {
      const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 422
      send(res, Number.isInteger(status) && status >= 400 && status < 600 ? status : 422, { message: error instanceof Error ? error.message : 'Project host operation failed' })
    }
    return true
  }
  const api: EditorHostHandler = async (req, res, next) => {
    if (!req.url?.startsWith(`${adapter.apiPrefix}/`))
      return next()
    const token = req.headers['x-advjs-workspace-session']
    const session = typeof token === 'string' && !disposed ? sessions.get(token) : undefined
    if (!session?.api) {
      send(res, 403, { message: 'Open a repository in the Editor before editing' })
      return
    }
    await session.api(req, res, next)
  }
  return { controlPath: EDITOR_PROJECT_HOST_PATH, controlToken, initialRoot: initial.root, apiPrefix: adapter.apiPrefix, handleRequest, api, dispose() {
    disposed = true
    sessions.clear()
  } }
}
