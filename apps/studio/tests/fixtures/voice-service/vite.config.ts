import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { startStudioVoiceServiceFixture } from './server'

export default defineConfig(async () => {
  let fixture = await startStudioVoiceServiceFixture()
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    server: { host: '127.0.0.1', port: 3388, strictPort: true, watch: null, fs: { allow: [fileURLToPath(new URL('../../../../..', import.meta.url))] } },
    define: { 'import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL': JSON.stringify('http://127.0.0.1:3389'), 'import.meta.env.VITE_ADVJS_AI_RUNTIME_URL': JSON.stringify(''), '__DEV__': 'true' },
    resolve: { alias: ['audio', 'assets', 'core', 'parser', 'types'].map(name => ({ find: `@advjs/${name}`, replacement: fileURLToPath(new URL(`../../../../../packages/${name}/src/index.ts`, import.meta.url)) })) },
    plugins: [Vue(), {
      name: 'studio-voice-http-fixture',
      resolveId(id) {
        if (id === 'virtual:advjs-game-locales')
          return '\0fixture:game-locales'
      },
      load(id) {
        if (id === '\0fixture:game-locales')
          return 'export default {en:{},"zh-CN":{}}'
      },
      configureServer(server) {
        server.middlewares.use('/fixture', async (request, response, next) => {
          try {
            if (request.url === '/reset' && request.method === 'POST') {
              await fixture.close()
              fixture = await startStudioVoiceServiceFixture()
              response.end('{}')
            }
            else if (request.url === '/status') {
              response.setHeader('content-type', 'application/json')
              response.end(JSON.stringify(await fixture.status()))
            }
            else if (request.url === '/files') {
              response.setHeader('content-type', 'application/json')
              response.end(JSON.stringify(fixture.initialFiles))
            }
            else if (request.url === '/hold') {
              fixture.hold()
              response.end('{}')
            }
            else if (request.url === '/release') {
              fixture.release()
              response.end('{}')
            }
            else { next() }
          }
          catch {
            response.statusCode = 500
            response.end('{}')
          }
        })
        server.httpServer?.on('close', () => void fixture.close())
      },
    }],
  }
})
