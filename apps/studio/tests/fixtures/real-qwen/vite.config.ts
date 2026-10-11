import { Buffer } from 'node:buffer'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import createStudioConfig from '../../../vite.config'
import { startStudioRealQwenReplayFixture } from './replay'
import { startStudioRealQwenFixture } from './server'

export default async function configuration() {
  const base = await createStudioConfig({ command: 'serve' })
  const fixture = process.env.ADVJS_REAL_QWEN_STUDIO_REPLAY ? await startStudioRealQwenReplayFixture() : await startStudioRealQwenFixture()
  return { ...base, root: import.meta.dirname, server: { host: '127.0.0.1', port: 3396, strictPort: true, watch: null, fs: { allow: [fileURLToPath(new URL('../../../../..', import.meta.url))] } }, define: { ...base.define, 'import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL': JSON.stringify('http://127.0.0.1:3397'), 'import.meta.env.VITE_ADVJS_AI_RUNTIME_URL': JSON.stringify('') }, resolve: { alias: [...base.resolve.alias, ...['audio', 'assets', 'core'].map(name => ({ find: `@advjs/${name}`, replacement: fileURLToPath(new URL(`../../../../../packages/${name}/src/index.ts`, import.meta.url)) }))] }, plugins: [...base.plugins, {
    name: 'studio-real-qwen-opt-in-http-fixture',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/fixture', async (request, response, next) => {
        try {
          response.setHeader('content-type', 'application/json')
          if (request.url === '/files') {
            response.end(JSON.stringify(fixture.files))
          }
          else if (request.url === '/metadata') {
            response.end(JSON.stringify(fixture.metadata))
          }
          else if (request.url === '/media') {
            response.end(JSON.stringify(fixture.media))
          }
          else if (request.url?.startsWith('/media/')) {
            const { bytes, mimeType } = await fixture.mediaBytes(decodeURIComponent(request.url.slice('/media/'.length)))
            response.setHeader('content-type', mimeType)
            response.end(bytes)
          }
          else if (request.url === '/status') {
            response.end(JSON.stringify(await fixture.status()))
          }
          else if (request.url === '/handoff' && request.method === 'POST') {
            const chunks: Buffer[] = []
            let count = 0
            for await (const chunk of request) {
              count += chunk.length
              if (count > 64 * 1024 * 1024)
                throw new Error('REAL_QWEN_EXPORT_LIMIT')
              chunks.push(chunk)
            }
            response.end(JSON.stringify(await fixture.handoff(Buffer.concat(chunks))))
          }
          else {
            next()
          }
        }
        catch (error) {
          response.statusCode = 500
          response.end(JSON.stringify({ error: String(error) }))
        }
      })
      server.httpServer?.on('close', () => void fixture.close())
    },
  }] }
}
