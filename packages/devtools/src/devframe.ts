import type { DevToolsReport } from './types'
import { fileURLToPath } from 'node:url'
import { createShikiService } from '@devframes/service-shiki'
import { defineDevframe, defineRpcFunction } from 'devframe'
import pkg from '../package.json'
import { highlightDevToolsJson } from './highlight'

/** Portable definition: also usable inside a Devframe hub. */
export function createAdvDevToolsDevframe(getReport?: () => DevToolsReport) {
  return defineDevframe({
    id: 'advjs-devtools',
    name: 'ADV.JS DevTools',
    version: pkg.version,
    packageName: pkg.name,
    importMetaUrl: import.meta.url,
    homepage: 'https://advjs.org',
    description: 'Inspect ADV.JS runtime state, story traces, resources and diagnostics.',
    icon: 'carbon:debug',
    capabilities: { build: false },
    clientAssets: fileURLToPath(new URL('../dist/client/', import.meta.url)),
    services: [createShikiService({ langs: ['json'] })],
    setup(ctx) {
      ctx.scope('advjs-devtools').rpc.register(defineRpcFunction({
        name: 'highlight-json',
        type: 'query',
        cacheable: true,
        jsonSerializable: true,
        handler: (code: string) => highlightDevToolsJson(ctx.services.get('@devframes/service-shiki'), code),
      }))
      ctx.scope('advjs-devtools').rpc.register(defineRpcFunction({
        name: 'inspect',
        type: 'query',
        cacheable: false,
        jsonSerializable: true,
        handler: (): DevToolsReport => getReport?.() ?? {
          project: { root: ctx.cwd },
          sessions: [],
        },
      }))
    },
  })
}

export default createAdvDevToolsDevframe
