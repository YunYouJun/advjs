import path from 'path'
import { defineConfig } from 'vite'

import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { VitePWA } from 'vite-plugin-pwa'

import { defaultConfig } from './node_modules/vitepress-theme-you/src/config'

export default defineConfig({
  resolve: {
    alias: {
      '@/': `${path.resolve(__dirname, '.vitepress/theme')}/`,
      'advjs/': `${path.resolve(__dirname, '../packages/advjs/src')}/`,
    },
  },
  plugins: [
    ...defaultConfig.plugins,
    Components({
      dirs: ['.vitepress/theme/components'],
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

  optimizeDeps: {
    include: ['dayjs'],
  },
})
