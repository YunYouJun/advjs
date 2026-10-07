import type { ResolvedAdvOptions } from '@advjs/types'
import type { PluginOption } from 'vite'
import type { AdvServerOptions } from '../options'
import { join } from 'node:path'
import AdvDevTools from '@advjs/devtools'

export async function createDevToolsPlugins(
  options: Pick<ResolvedAdvOptions, 'mode' | 'clientRoot' | 'userRoot' | 'data'>,
  serverOptions: AdvServerOptions,
): Promise<PluginOption[]> {
  if (serverOptions.devtools === false || options.mode !== 'dev')
    return []

  const tools = typeof serverOptions.devtools === 'object' ? serverOptions.devtools : {}
  const plugins: PluginOption[] = []
  if (tools.adv !== false)
    plugins.push(AdvDevTools({ project: { root: options.userRoot, title: options.data.gameConfig?.title } }))
  if (tools.vue ?? options.data.config.devtools?.vue ?? false) {
    const { default: vueDevTools } = await import('vite-plugin-vue-devtools')
    plugins.push(vueDevTools({ appendTo: join(options.clientRoot, 'main.ts') }))
  }
  return plugins
}
