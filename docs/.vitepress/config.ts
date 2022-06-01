import path from 'path'
import type { YouTheme } from 'vitepress-theme-you'
import type { UserConfig } from 'vitepress'

import Components from 'unplugin-vue-components/vite'
import { VitePWA } from 'vite-plugin-pwa'

// @ts-expect-error config type
import baseConfig from 'vitepress-theme-you/config'
import themeConfig from './config/theme'
import head from './config/head'
import { metaData } from './config/constants'

const config: UserConfig<YouTheme.Config> = {
  extends: baseConfig,

  vite: {
    resolve: {
      alias: {
        '@/': `${path.resolve(__dirname, 'theme')}/`,
        'advjs/': `${path.resolve(__dirname, '../../packages/advjs/src')}/`,
      },
    },
    plugins: [
      Components({
        dirs: [path.resolve(__dirname, './theme/components')],
        extensions: ['vue', 'ts'],
        include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
        dts: true,
      }),

      // https://github.com/antfu/vite-plugin-pwa
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'robots.txt', 'safari-pinned-tab.svg'],
        manifest: {
          name: 'ADV.JS',
          short_name: 'ADV',
          theme_color: '#000',
        },
      }),
    ],

    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..'],
      },
    },
  },

  ...metaData,

  head,
  themeConfig,
  srcExclude: ['README.md'],
}

export default config
