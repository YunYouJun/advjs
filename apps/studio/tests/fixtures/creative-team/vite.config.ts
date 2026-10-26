import { resolve } from 'node:path'
import createStudioConfig from '../../../vite.config'

/** The real Studio app, with paid services disabled and dependency watchers off for isolated QA. */
export default async function configuration() {
  const base = await createStudioConfig({ command: 'serve' })
  return {
    ...base,
    root: resolve(import.meta.dirname, '../../..'),
    define: {
      ...base.define,
      'import.meta.env.VITE_ADVJS_AI_RUNTIME_URL': JSON.stringify(''),
      'import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL': JSON.stringify(''),
    },
    server: { host: '127.0.0.1', port: 4198, strictPort: true, watch: null, fs: { allow: [resolve(import.meta.dirname, '../../../../..')] } },
  }
}
