import type { Plugin } from 'vite'
import type { AdvPluginOptions, ResolvedAdvOptions } from '../../advjs/node'
import path from 'node:path'
import process from 'node:process'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'

import Layouts from 'vite-plugin-vue-layouts'
import { createComponentsPlugin } from '../../advjs/node/vite/components'
import { createConfigPlugin } from '../../advjs/node/vite/extendConfig'
import { createAdvVirtualLoader } from '../../advjs/node/vite/loaders'
import { advClientDir, themesDir } from '../../shared/node/vite'
import { vitePluginAdv } from './adv'

// theme?: string
// roots?: string[]

// components?: ArgumentsType<typeof Components>[0]

export default function advFramework(options: ResolvedAdvOptions, pluginOptions: AdvPluginOptions): Plugin[] {
  let { roots = [process.cwd()], theme = 'default' } = options

  const themeDir = path.resolve(themesDir, `theme-${theme}`)
  roots = [
    advClientDir,
    themeDir,
    ...roots,
  ]

  const advVirtualLoader = createAdvVirtualLoader({
    roots,
  } as any, {})

  return [
    createConfigPlugin(options),
    vitePluginAdv(),
    advVirtualLoader,

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDirs: roots.map(root => path.join(root, 'layouts')),
    }),

    createComponentsPlugin(options, {
      ...pluginOptions,
      components: {
        ...pluginOptions.components,
        dirs: [
          // use shared components
          path.resolve(advClientDir, 'components'),
          path.resolve(themeDir, 'components'),
          // local components
          path.resolve(process.cwd(), 'src/components'),
          ...pluginOptions.components?.dirs || [],
        ],
      },
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
      include: roots.map(root => path.resolve(root, 'locales/**')),
    }),
  ]
}
