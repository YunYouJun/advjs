import type { Plugin } from 'vite'
import path from 'node:path'
import process from 'node:process'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Components from 'unplugin-vue-components/vite'
import Layouts from 'vite-plugin-vue-layouts'
import { createAdvVirtualLoader } from '../../advjs/node/plugins/loaders'
import { advClientDir, themesDir } from '../../shared/node/vite'
import { vitePluginAdv } from './adv'

export default function advFramework(options: {
  theme?: string
  roots?: string[]
} = {}): Plugin[] {
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
    vitePluginAdv(),
    advVirtualLoader,

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDirs: roots.map(root => path.join(root, 'layouts')),
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: 'src/components.d.ts',

      dirs: [
        // use shared components
        path.resolve(advClientDir, 'components'),
        path.resolve(themeDir, 'components'),
        // local components
        path.resolve(process.cwd(), 'src/components'),
      ],
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
