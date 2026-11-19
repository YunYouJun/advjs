import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test as base } from '@playwright/test'

interface ChatRequest {
  stream: boolean
  model: string
  messages: { role: string, content: string }[]
  max_tokens: number
}

interface Reply {
  first: string
  rest?: string
  resume?: Promise<void>
}

const chatPath = '/v1/chat/completions'

function event(data: object | '[DONE]') {
  return `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\r\n\r\n`
}

function delta(content: string) {
  return event({ choices: [{ delta: { content } }] })
}

export function pauseStream(first: string, rest?: string) {
  const { promise, resolve } = Promise.withResolvers<void>()
  return { reply: { first, rest, resume: promise }, release: resolve }
}

async function startReplay(page: Page) {
  const replies: Reply[] = []
  const requests: ChatRequest[] = []
  const problems: string[] = []
  let interrupted = 0
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST')
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
    if (req.url !== chatPath) {
      res.writeHead(404).end()
      return
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }
    try {
      const chunks: Buffer[] = []
      for await (const chunk of req)
        chunks.push(chunk)
      const request: ChatRequest = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!request.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }))
        return
      }

      const reply = replies.shift()
      if (!reply) {
        problems.push('Unexpected streaming request')
        res.writeHead(500).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' })
      const closed = once(res, 'close').then(() => {
        if (!res.writableEnded)
          interrupted++
      })
      res.write(delta(reply.first))
      if (reply.resume)
        await Promise.race([reply.resume, closed])
      if (res.destroyed)
        return
      if (reply.rest)
        res.write(delta(reply.rest))
      res.end(event({ choices: [], usage: { prompt_tokens: 21, completion_tokens: 9 } }) + event('[DONE]'))
    }
    catch {
      problems.push('Replay could not read or answer the request')
      res.destroy()
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Replay server needs an ephemeral TCP port')

  const origin = `http://127.0.0.1:${address.port}`
  // Let the loopback server deliver actual HTTP chunks. Block unexpected provider traffic.
  let failures = 0
  await page.route('**/chat/completions', (route) => {
    const request = route.request()
    if (request.url() !== `${origin}${chatPath}`)
      return route.abort()
    if (request.method() === 'POST') {
      const chat = request.postDataJSON() as ChatRequest
      requests.push(chat)
      if (chat.stream && failures > 0) {
        failures--
        return route.abort('connectionreset')
      }
    }
    return route.continue()
  })
  return {
    baseURL: `${origin}/v1`,
    requests,
    problems,
    get interrupted() { return interrupted },
    enqueue(...next: Reply[]) { replies.push(...next) },
    failNext(count: number) { failures = count },
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}

export const test = base.extend<{ replay: Awaited<ReturnType<typeof startReplay>> }>({
  replay: async ({ page }, use) => {
    const replay = await startReplay(page)
    try {
      await use(replay)
    }
    finally {
      await replay.close()
    }
  },
})
