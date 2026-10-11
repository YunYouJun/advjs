import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: {
    host: '127.0.0.1',
    port: 3347,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] },
  },
  plugins: [{
    name: 'audio-fixture-error',
    configureServer(server) {
      server.middlewares.use('/__audio_failure__.wav', (_request, response) => {
        response.statusCode = 503
        response.end('Intentional offline audio failure fixture')
      })
    },
  }],
})
