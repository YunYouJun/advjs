import path from 'node:path'
import { defineConfig } from 'vite'

import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'

// import { componentsDir } from '@advjs/gui/node'
// no compile
import { componentsDir } from '../packages/gui/node'

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler', // or "modern", "legacy"
        importers: [
          // ...
        ],
      },
    },
  },

  resolve: {
    alias: {
      '@advjs/gui/': `${path.resolve(__dirname, '../packages/gui')}/`,
      '@advjs/gui': `${path.resolve(__dirname, '../packages/gui/client/index.ts')}`,
      '@/': `${path.resolve(__dirname, 'theme')}/`,
      'advjs/': `${path.resolve(__dirname, '../../packages/advjs')}/`,
    },
  },

  server: {
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        `!${componentsDir}`,
      ],
    },
  },

  plugins: [
    Components({
      include: [/\.vue/, /\.md/],
      dirs: [
        '.vitepress/components',
        componentsDir,
      ],
      dts: '.vitepress/components.d.ts',
    }),

    // https://github.com/antfu/unocss
    // see unocss.config.ts for config
    Unocss(),
  ],
})
