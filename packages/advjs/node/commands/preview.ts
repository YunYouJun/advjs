import type { AdvEntryOptions } from '@advjs/types'
import type { Buffer } from 'node:buffer'
import type { InlineConfig } from 'vite'
import { extname } from 'node:path'
import { resolveOptions } from '../options'
import { loadProject } from '../project'
import { prepareProjectGame } from './build/project'
import { createServer } from './serve'

/** Vite player for a managed project mirror, independent of the editor bridge. */
export async function createProjectPreviewServer(entry: AdvEntryOptions, vite: InlineConfig = {}, preview: { vueDevtools?: boolean } = {}) {
  const frameSource = preview.vueDevtools === true ? '\'self\'' : '\'none\''
  let resources = new Map<string, Buffer>()
  async function load() {
    const options = await resolveOptions({ ...entry }, 'dev')
    const project = await loadProject({ root: options.userRoot })
    const errors = project.result.diagnostics.filter(item => item.severity === 'error')
    if (project.config.format !== 'synthetic' && errors.length)
      throw new Error(`Project compilation failed: ${errors[0].code} ${errors[0].message}`)
    const markdown = project.result.project.format === 'adv-md' && Object.keys(project.files).some(path => path.endsWith('.adv.md'))
    const prepared = markdown ? await prepareProjectGame(project) : undefined
    if (prepared)
      options.data.gameConfig = prepared.game
    const sources = Object.keys(project.files).filter(path => /^(?:pages|layouts|components|styles|client)\//u.test(path)).sort().join('\n')
    return { options, resources: prepared?.resources ?? new Map<string, Buffer>(), sources }
  }
  const initial = await load()
  resources = initial.resources
  let options = initial.options
  let sources = initial.sources
  async function createPlayer(port?: number) {
    return createServer(options, {
      ...vite,
      ...(port === undefined ? {} : { server: { ...vite.server, port, strictPort: true } }),
      plugins: [
        ...(vite.plugins ?? []),
        {
          name: 'advjs:project-preview-resources',
          configureServer(server) {
            server.middlewares.use((request, response, next) => {
              const url = new URL(request.url ?? '/', 'http://localhost')
              response.setHeader('content-security-policy', `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' ws: data: blob: https:; frame-src ${frameSource}; object-src 'none'`)
              if (url.pathname.startsWith('/__advjs/') || /(?:^|\/)\.env(?:\.|\/|$)/u.test(url.pathname)) {
                response.writeHead(404).end()
                return
              }
              const bytes = resources.get(url.pathname.slice(1))
              if (!bytes)
                return next()
              const mime = ({ '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4' } as Record<string, string>)[extname(url.pathname)] ?? 'application/octet-stream'
              response.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' })
              response.end(bytes)
            })
          },
        },
      ],
    }, { devtools: { adv: false, vue: preview.vueDevtools === true } })
  }
  let server = await createPlayer()
  let port: number | undefined
  return {
    get server() { return server },
    async refresh() {
      const next = await load()
      if (next.options.theme !== options.theme || JSON.stringify(next.options.data.config.plugins) !== JSON.stringify(options.data.config.plugins))
        throw new Error('主题或插件配置已变更，请重新运行预览')
      resources = next.resources
      // New overrides change route/component priorities, which are computed
      // when plugins initialize. Recreate them on the same origin; Vite's
      // disconnected client reconnects and reloads the existing player.
      if (next.sources !== sources) {
        port ??= (server.httpServer?.address() as { port: number } | null)?.port
        if (port === undefined)
          throw new Error('Preview server is not listening')
        await server.close()
        options = next.options
        server = await createPlayer(port)
        await server.listen()
        sources = next.sources
        return true
      }
      Object.assign(options.data, next.options.data)
      server.moduleGraph.invalidateAll()
      server.ws.send({ type: 'full-reload' })
      return false
    },
  }
}
