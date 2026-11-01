import type { IncomingMessage, ServerResponse } from 'node:http'
import { request as httpRequest } from 'node:http'

/** Development host config, never a renderer-supplied URL. Forward only the declared API prefix. */
export function createDesktopHostApi(input?: string, workspaceSession?: string) {
  if (!input)
    return undefined
  const target = new URL(input)
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname) || !target.port || target.username || target.password || target.search || target.hash || !/^\/api\/[a-z][a-z0-9-]*\/$/u.test(target.pathname))
    throw new Error('Desktop host API must be a fixed loopback /api/name/ URL')
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!req.url?.startsWith(target.pathname))
      return false
    const url = new URL(req.url, target.origin)
    if (url.origin !== target.origin || !url.pathname.startsWith(target.pathname) || /%2f|%5c/i.test(url.pathname))
      return false
    await new Promise<void>((done, fail) => {
      const headers = { 'content-type': req.headers['content-type'] ?? '', 'x-editor-token': req.headers['x-editor-token'] ?? '', 'origin': target.origin, ...(workspaceSession ? { 'x-advjs-workspace-session': workspaceSession } : {}) }
      const upstream = httpRequest(url, { method: req.method, headers }, (response) => {
        res.writeHead(response.statusCode ?? 502, { 'Content-Type': response.headers['content-type'] ?? 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        response.on('error', fail)
        response.pipe(res)
        response.on('end', done)
      })
      upstream.setTimeout(30000, () => upstream.destroy(new Error('Desktop document host timed out')))
      upstream.on('error', fail)
      req.on('aborted', () => upstream.destroy())
      req.pipe(upstream)
    })
    return true
  }
}
