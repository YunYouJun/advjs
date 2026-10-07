import type { Plugin, WebSocketClient } from 'vite'
import type { AdvDevToolsOptions } from './types'
import { fileURLToPath } from 'node:url'
import { devframeViteBridge, devframeVitePlugin } from '@devframes/vite/single'
import { createAdvDevToolsDevframe } from './devframe'
import { createDevToolsSessions } from './sessions'
import { DEVTOOLS_BASE, DEVTOOLS_EVENT } from './types'

export { createAdvDevToolsDevframe } from './devframe'
export type { AdvDevToolsOptions, DevToolsReport, DevToolsSnapshot } from './types'

/** @deprecated Use AdvDevToolsOptions. */
export type VitePluginAdvDevToolsOptions = AdvDevToolsOptions

export function VitePluginAdvDevTools(options: AdvDevToolsOptions = {}): Plugin[] {
  const base = `/${(options.base ?? DEVTOOLS_BASE).replace(/^\/+|\/+$/g, '')}/`
  const sessions = createDevToolsSessions<WebSocketClient>()
  let root = options.project?.root ?? ''
  const definition = createAdvDevToolsDevframe(() => ({
    project: { ...options.project, root },
    sessions: sessions.list(),
  }))
  const runtime: Plugin = {
    name: 'advjs:devtools',
    apply: 'serve',
    resolveId(id) {
      // Vite also warms injected module scripts before the static middleware runs.
      if (id === `${base}runtime.js`)
        return fileURLToPath(new URL('../dist/client/runtime.js', import.meta.url))
    },
    configureServer(server) {
      root ||= server.config.root
      const clients = new Set<WebSocketClient>()
      const receive = (data: unknown, client: WebSocketClient) => {
        if (sessions.update(client, data) && !clients.has(client)) {
          clients.add(client)
          client.socket.once('close', () => {
            clients.delete(client)
            sessions.remove(client)
          })
        }
      }
      server.ws.on(DEVTOOLS_EVENT, receive)
      server.httpServer?.once('close', () => {
        server.ws.off(DEVTOOLS_EVENT, receive)
        sessions.clear()
        clients.clear()
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{
        tag: 'script',
        attrs: { type: 'module', src: `${base}runtime.js` },
        injectTo: 'head',
      }],
    },
  }
  // The read-only inspector retains Devframe's loopback origin restriction.
  const bridge = devframeViteBridge(definition, { base, auth: false, mcp: false })
  bridge.apply = 'serve'
  return [runtime, devframeVitePlugin(definition, { base }), bridge]
}

export default VitePluginAdvDevTools
