import path from 'node:path'
import { defineConfig } from 'vite'

import Components from 'unplugin-vue-components/vite'
import { presetAttributify, presetIcons, presetUno } from 'unocss'
import Unocss from 'unocss/vite'

// import { componentsDir } from '@advjs/gui/node'
// no compile
import { componentsDir } from '../packages/gui/node'

export default defineConfig({
  resolve: {
    alias: {
      '@advjs/gui/': `${path.resolve(__dirname, '../packages/gui')}/`,
      '@advjs/gui': `${path.resolve(__dirname, '../packages/gui/client/index.ts')}`,
      '@/': `${path.resolve(__dirname, 'theme')}/`,
      'advjs/': `${path.resolve(__dirname, '../../packages/advjs')}/`,
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
    Unocss({
      shortcuts: [
        ['btn', 'px-4 py-1 rounded inline-flex justify-center gap-2 text-white leading-30px children:mya !no-underline cursor-pointer disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
      ],
      presets: [
        presetUno({
          dark: 'media',
        }),
        presetAttributify(),
        presetIcons({
          scale: 1.2,
        }),
      ],
    }),
  ],
})
