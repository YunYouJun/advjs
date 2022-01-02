import { UserConfig } from 'vitepress'
import type { YouTheme } from 'vitepress-theme-you'
import { metaData } from './config/constants'
import head from './config/head'
import themeConfig from './config/theme'

import path from 'path'

import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { VitePWA } from 'vite-plugin-pwa'

// @ts-ignore
import baseConfig from 'vitepress-theme-you/config'

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
        dirs: ['theme/components'],
        extensions: ['vue', 'ts'],
        include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
        resolvers: [
          IconsResolver({
            // componentPrefix: '',
          }),
        ],
        dts: true,
      }),

      Icons({
        autoInstall: true,
      }),

      // https://github.com/antfu/vite-plugin-pwa
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'robots.txt', 'safari-pinned-tab.svg'],
        manifest: {
          name: 'ADV.JS',
          short_name: 'ADV',
          theme_color: '#000',
          icons: [
            {
              src: '/icons/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
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
