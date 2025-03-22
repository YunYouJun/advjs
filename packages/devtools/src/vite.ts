import type { PluginOption } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { consola } from 'consola'
import { normalizePath } from 'vite'
import { PLUGIN_NAME } from './constant'

function getAdvDevtoolsPath() {
  const pluginPath = normalizePath(path.dirname(fileURLToPath(import.meta.url)))
  return pluginPath.replace(/\/dist$/, '\/src')
}

export interface VitePluginAdvDevToolsOptions {
  /**
   * Customize openInEditor host (e.g. http://localhost:3000)
   * @default false
   */
  openInEditorHost?: string | false
}

export function VitePluginAdvDevTools(options?: VitePluginAdvDevToolsOptions) {
  const advDevtoolsPath = getAdvDevtoolsPath()
  if (options)
    consola.debug(options)
  consola.info('Virtual Adv DevTools Path:', advDevtoolsPath)

  const plugin = <PluginOption>{
    name: PLUGIN_NAME,
    enforce: 'pre',
    apply: 'serve',

    async resolveId(importer: string) {
      if (importer.startsWith('virtual:adv-devtools-options')) {
        return importer
      }
      else if (importer.startsWith('virtual:adv-devtools-path:')) {
        const resolved = importer.replace('virtual:adv-devtools-path:', `${advDevtoolsPath}/`)
        return resolved
      }
    },

    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            injectTo: 'head',
            attrs: {
              type: 'module',
              src: '/@id/virtual:adv-devtools-path:app.js',
            },
          },
        ],
      }
    },
  }

  return [
    plugin,
  ]
}

export default VitePluginAdvDevTools
