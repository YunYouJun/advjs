import { resolve } from 'node:path'
import createStudioConfig from '../../../vite.config'

export default async function configuration() {
  const base = await createStudioConfig({ command: 'serve' })
  return {
    ...base,
    root: resolve(import.meta.dirname, '../../..'),
    define: {
      ...base.define,
      'import.meta.env.VITE_ADVJS_AI_RUNTIME_URL': JSON.stringify('http://localhost:4203/fixture-service'),
      'import.meta.env.VITE_ADVJS_AI_RUNTIME_PROTOCOL': JSON.stringify('v2'),
      'import.meta.env.VITE_ADVJS_AI_RUNTIME_APPLICATION_ID': JSON.stringify('advjs-studio-web'),
      'import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL': JSON.stringify('http://localhost:4203/fixture-service'),
    },
    server: { host: '127.0.0.1', port: 4203, strictPort: true, watch: null, fs: { allow: [resolve(import.meta.dirname, '../../../../..')] } },
  }
}
