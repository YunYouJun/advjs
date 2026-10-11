import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import COS from 'cos-nodejs-sdk-v5'
import { CosStorage } from '../../../plugins/plugin-cos/src'

/** Real COS SDK against a bounded local HTTP protocol test server, no cloud credentials. */
export async function createCosHttpFixture(versioning?: 'Enabled' | 'Suspended') {
  const objects = new Map<string, { bytes: Buffer, headers: Record<string, string> }>()
  const hideOnHead = new Set<string>()
  const requests: Array<{ method: string, key: string, headers: Record<string, unknown> }> = []
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url!, 'http://127.0.0.1')
      const key = decodeURIComponent(url.pathname.slice(1))
      requests.push({ method: request.method!, key, headers: { ...request.headers } })
      // Only this local public-media fixture permits browser origins. Real COS/CDN
      // deployments must configure their own player-origin CORS policy.
      response.setHeader('access-control-allow-origin', '*')
      response.setHeader('access-control-allow-methods', 'GET, HEAD, OPTIONS')
      response.setHeader('access-control-allow-headers', 'Range')
      response.setHeader('access-control-expose-headers', 'Content-Length, Content-Type, ETag')
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return
      }
      if (url.searchParams.has('versioning')) {
        response.setHeader('content-type', 'application/xml')
        response.end(`<VersioningConfiguration>${versioning ? `<Status>${versioning}</Status>` : ''}</VersioningConfiguration>`)
        return
      }
      const existing = objects.get(key)
      if (request.method === 'HEAD' && hideOnHead.has(key)) {
        response.writeHead(404)
        response.end()
        return
      }
      if (request.method === 'PUT') {
        if (existing && request.headers['x-cos-forbid-overwrite'] === 'true') {
          response.writeHead(409, { 'content-type': 'application/xml' })
          response.end('<Error><Code>FileAlreadyExists</Code><Message>Immutable conflict</Message></Error>')
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of request)
          chunks.push(Buffer.from(chunk))
        const bytes = Buffer.concat(chunks)
        const headers = { 'content-length': String(bytes.byteLength), 'content-type': String(request.headers['content-type']), 'cache-control': String(request.headers['cache-control']), 'etag': `"${createHash('md5').update(bytes).digest('hex')}"`, ...Object.fromEntries(Object.entries(request.headers).filter(([key]) => key.startsWith('x-cos-meta-')).map(([key, value]) => [key, String(value)])) }
        objects.set(key, { bytes, headers })
        response.setHeader('etag', headers.etag)
        response.end()
      }
      else if (existing && ['HEAD', 'GET'].includes(request.method!)) {
        if (request.headers['if-match'] && request.headers['if-match'] !== existing.headers.etag) {
          response.writeHead(412)
          response.end()
          return
        }
        response.writeHead(200, existing.headers)
        response.end(request.method === 'HEAD' ? undefined : existing.bytes)
      }
      else {
        response.writeHead(404)
        response.end()
      }
    }
    catch {
      response.writeHead(500)
      response.end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()!
  if (typeof address === 'string')
    throw new Error('Fixture address invalid')
  const url = `http://127.0.0.1:${address.port}/`
  const storage = new CosStorage({
    bucket: 'test-only-1234567890',
    region: 'ap-test',
    prefix: '',
    client: new COS({ SecretId: 'test-only', SecretKey: 'test-only', Protocol: 'http:', Domain: `127.0.0.1:${address.port}`, FollowRedirect: false, Timeout: 5_000 }),
  })
  return { storage, url, objects, requests, hideOnHead, async close() {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  } }
}
