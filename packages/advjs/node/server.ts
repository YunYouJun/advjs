import { join } from 'path'
import type { InlineConfig } from 'vite'
import { createServer as createViteServer, resolveConfig } from 'vite'
import { mergeViteConfigs } from './common'
import type { AdvServerOptions, ResolvedAdvOptions } from './options'
import { ViteAdvPlugin } from './plugins/preset'

export async function createServer(
  options: ResolvedAdvOptions,
  viteConfig: InlineConfig = {},
  serverOptions: AdvServerOptions = {},
) {
  const rawConfig = await resolveConfig({}, 'serve')
  const pluginOptions = rawConfig.advjs || {}

  // default open editor to code, #312
  process.env.EDITOR = process.env.EDITOR || 'code'

  // todo
  // import { commonAlias } from '../shared/config/vite'
  const server = await createViteServer(
    await mergeViteConfigs(
      options,
      viteConfig,
      <InlineConfig>({
        resolve: {
          alias: {
            'node:fs': 'fs',
          },
        },
        optimizeDeps: {
          entries: [
            join(options.clientRoot, 'main.ts'),
          ],
        },
        plugins: [
          await ViteAdvPlugin(options, pluginOptions, serverOptions),
        ],
      }),
      'serve',
    ),
  )

  return server
}

// optimizeDeps: {
//   include: [
//     'vue',
//     'vue-router',
//     '@vueuse/core',
//     '@vueuse/head',
//     '@vueuse/motion',
//     'dayjs',
//     'js-yaml',
//     'unified',
//     'remark-parse',
//     'remark-frontmatter',
//     'remark-gfm',
//     'remark-rehype',
//     'rehype-stringify',
//     'consola',
//     'unstorage',
//     'unstorage/drivers/localstorage',
//     'html2canvas',
//   ].concat(babylonDependencies),
//   exclude: [
//     'vue-demi',
//   ],
// },
