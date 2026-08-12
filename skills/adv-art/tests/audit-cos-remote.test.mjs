import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { it } from 'vitest'
import { auditCosRemote } from '../scripts/audit-cos-remote.mjs'

it('verifies remote bytes, metadata, cache semantics, and GET/HEAD CORS', async () => {
  const bytes = Buffer.from('remote image bytes')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const objectKey = `games/example/v1/backgrounds/room.${sha256.slice(0, 12)}.webp`
  const exposeHeaders = [
    'Cache-Control',
    'Content-Length',
    'Content-Type',
    'ETag',
    'x-cos-meta-advjs-id',
    'x-cos-meta-sha256',
  ]
  const server = createServer((request, response) => {
    if (request.url !== `/${objectKey}`) {
      response.writeHead(404).end()
      return
    }
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD')
    response.setHeader('Access-Control-Expose-Headers', exposeHeaders.join(', '))
    response.setHeader('Cache-Control', 'immutable, public, max-age=31536000')
    response.setHeader('Content-Length', request.method === 'OPTIONS' ? 0 : bytes.length)
    response.setHeader('Content-Type', 'image/webp')
    response.setHeader('ETag', 'fixture')
    response.setHeader('x-cos-meta-advjs-id', 'background/room')
    response.setHeader('x-cos-meta-advjs-schema', '2')
    response.setHeader('x-cos-meta-sha256', sha256)
    response.writeHead(200)
    response.end(request.method === 'HEAD' || request.method === 'OPTIONS' ? undefined : bytes)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  try {
    const address = server.address()
    assert(address && typeof address === 'object')
    const plan = {
      publicBaseUrl: `http://127.0.0.1:${address.port}/`,
      policy: {
        cors: {
          allowedMethods: ['GET', 'HEAD'],
          exposeHeaders,
        },
      },
      objects: [{
        id: 'background/room',
        objectKey,
        bytes: bytes.length,
        sha256,
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      }],
    }

    assert.deepEqual(await auditCosRemote(plan, {
      concurrency: 1,
      origin: 'https://demo.advjs.org',
      timeoutMs: 2_000,
    }), {
      objectCount: 1,
      schemaVersions: { 2: 1 },
      errors: [],
    })
  }
  finally {
    await new Promise(resolve => server.close(resolve))
  }
})
