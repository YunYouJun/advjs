import { resolve } from 'node:path'
import createStudioConfig from '../../../vite.config'

/** Actual product pages and HTTP clients; no fetch interception or client/store injection. */
export default async function configuration() {
  const base = await createStudioConfig({ command: 'serve' })
  return {
    ...base,
    plugins: [...base.plugins, { name: 'explicit-local-runtime-bootstrap', transformIndexHtml: (html: string) => html.replace('src="/src/main.ts"', 'src="/tests/fixtures/creative-team/runtime-entry.ts"') }],
    root: resolve(import.meta.dirname, '../../..'),
    define: {
      ...base.define,
      'import.meta.env.VITE_ADVJS_AI_RUNTIME_URL': JSON.stringify('http://127.0.0.1:4205'),
      'import.meta.env.VITE_ADVJS_AI_RUNTIME_PROTOCOL': JSON.stringify('v2'),
      'import.meta.env.VITE_ADVJS_AI_RUNTIME_APPLICATION_ID': JSON.stringify('advjs-studio-web'),
      'import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL': JSON.stringify(''),
    },
    server: { host: '127.0.0.1', port: 4204, strictPort: true, watch: null, fs: { allow: [resolve(import.meta.dirname, '../../../../..')] } },
  }
}
