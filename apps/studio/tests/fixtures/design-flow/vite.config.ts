import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'
import createStudioConfig from '../../../vite.config'
import { startStudioDesignFlowFixture } from './server'

export default async function configuration() {
  const base = await createStudioConfig({ command: 'serve' })
  let fixture = await startStudioDesignFlowFixture()
  return { ...base, root: import.meta.dirname, server: { host: '127.0.0.1', port: 3392, strictPort: true, watch: null, fs: { allow: [fileURLToPath(new URL('../../../../..', import.meta.url))] } }, define: { ...base.define, 'import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL': JSON.stringify('http://127.0.0.1:3393'), 'import.meta.env.VITE_ADVJS_AI_RUNTIME_URL': JSON.stringify('') }, resolve: { alias: [...base.resolve.alias, ...['audio', 'assets', 'core'].map(name => ({ find: `@advjs/${name}`, replacement: fileURLToPath(new URL(`../../../../../packages/${name}/src/index.ts`, import.meta.url)) }))] }, plugins: [...base.plugins, {
    name: 'studio-design-flow-http-fixture',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/fixture', async (request, response, next) => {
        try {
          if (request.url === '/reset' && request.method === 'POST') {
            await fixture.close()
            fixture = await startStudioDesignFlowFixture()
            response.end('{}')
          }
          else if (request.url === '/files') {
            response.setHeader('content-type', 'application/json')
            response.end(JSON.stringify(fixture.files))
          }
          else if (request.url === '/wave') {
            response.setHeader('content-type', 'audio/wav')
            response.end(fixture.bytes)
          }
          else if (request.url === '/status') {
            response.setHeader('content-type', 'application/json')
            response.end(JSON.stringify(await fixture.status()))
          }
          else if (request.url === '/hold') {
            fixture.hold()
            response.end('{}')
          }
          else if (request.url === '/release') {
            fixture.release()
            response.end('{}')
          }
          else if (request.url === '/handoff' && request.method === 'POST') {
            const chunks: Buffer[] = []
            let count = 0
            for await (const chunk of request) {
              count += chunk.length
              if (count > 8 * 1024 * 1024)
                throw new Error('Fixture limit')
              chunks.push(chunk)
            }
            response.setHeader('content-type', 'application/json')
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
