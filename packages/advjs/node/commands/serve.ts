import type { InlineConfig } from 'vite'
import type { AdvServerOptions, ResolvedAdvOptions } from '../options'
import { join } from 'node:path'
import process from 'node:process'

import { createServer as createViteServer } from 'vite'
import { VitePluginAdvDevTools } from '../../../devtools/src'
import { resolveViteConfigs } from './shared'

export async function createServer(
  options: ResolvedAdvOptions,
  viteConfig: InlineConfig = {},
  serverOptions: AdvServerOptions = {},
) {
  // default open editor to code, #312
  process.env.EDITOR = process.env.EDITOR || 'code'

  // todo
  // import { commonAlias } from '../shared/config/vite'

  const inlineConfig = await resolveViteConfigs(
    options,
    <InlineConfig>({
      optimizeDeps: {
        entries: [
          join(options.clientRoot, 'main.ts'),
        ],
      },
      plugins: [
        VitePluginAdvDevTools(),

      ],
    }),
    viteConfig,
    'serve',
    serverOptions,
  )

  const server = await createViteServer(inlineConfig)
  return server
}

// optimizeDeps: {
//   include: [
//     'vue',
//     'vue-router',
//     '@vueuse/core',
//     '@unhead/vue',
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
