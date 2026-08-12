#!/usr/bin/env node

import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

function readOption(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

async function main() {
  const json = process.argv.includes('--json')
  const host = readOption('--host', process.env.HOST || '127.0.0.1')
  const port = Number(readOption('--port', process.env.PORT || '3000'))
  const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const configuredPublicRoot = resolve(readOption('--root', resolve(packageRoot, 'dist')))

  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error(`Invalid port: ${port}`)

  const publicRoot = await realpath(configuredPublicRoot)
  const indexFile = resolve(publicRoot, 'index.html')

  function writeEvent(event) {
    const line = json ? JSON.stringify(event) : event.message
    process.stdout.write(`${line}\n`)
  }

  function isInsideRoot(file) {
    const pathFromRoot = relative(publicRoot, file)
    return pathFromRoot === '' || (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`))
  }

  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' })
      response.end()
      return
    }

    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
      const requested = resolve(publicRoot, pathname.replace(/^\/+/, '') || 'index.html')
      const requestedStat = isInsideRoot(requested) ? await stat(requested).catch(() => undefined) : undefined
      const file = requestedStat?.isFile() ? requested : indexFile
      const fileStat = await stat(file)

      response.writeHead(200, {
        'cache-control': file === indexFile ? 'no-cache' : 'public, max-age=31536000, immutable',
        'content-length': fileStat.size,
        'content-type': MIME_TYPES[extname(file)] || 'application/octet-stream',
        'x-content-type-options': 'nosniff',
      })
      if (request.method === 'HEAD')
        response.end()
      else
        createReadStream(file).pipe(response)
    }
    catch (error) {
      response.statusCode = 400
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolveListen)
  })

  const address = server.address()
  const actualPort = address && typeof address !== 'string' ? address.port : port
  const url = `http://${host}:${actualPort}`
  writeEvent({ event: 'ready', message: `ADV.JS Editor ready at ${url}`, url })

  let stopping = false
  async function stop(signal) {
    if (stopping)
      return
    stopping = true
    await new Promise(resolveClose => server.close(resolveClose))
    writeEvent({ event: 'stopped', message: `ADV.JS Editor stopped (${signal})`, signal })
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      stop(signal).catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
        process.exitCode = 1
      })
    })
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
})
