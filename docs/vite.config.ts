import path from 'node:path'
import { getViteConfig } from '@yunyoujun/docs'

import { defineConfig } from 'vite'

// import { componentsDir } from '@advjs/gui/node'
// no compile
import { componentsDir } from '../packages/gui/node'
import { homeChunkGuard } from './.vitepress/config/home-chunk-guard.ts'

const viteConfig = getViteConfig({
  componentsDirs: [
    componentsDir,
  ],
})

export default defineConfig({
  ...viteConfig,

  plugins: [
    ...(viteConfig.plugins ?? []),
    homeChunkGuard(),
  ],

  resolve: {
    alias: [
      { find: '@advjs/gui/', replacement: `${path.resolve(__dirname, '../packages/gui')}/` },
      { find: '@advjs/gui', replacement: `${path.resolve(__dirname, '../packages/gui/client/index.ts')}` },
      // The home page plays its stories on the headless runtime from source; docs builds don't build packages first.
      { find: /^@advjs\/types$/, replacement: `${path.resolve(__dirname, '../packages/types/src/index.ts')}` },
      // AI mode compiles stories in the browser, from source like the runtime above.
      { find: /^@advjs\/parser$/, replacement: `${path.resolve(__dirname, '../packages/parser/src/index.ts')}` },
      { find: /^@advjs\/audio$/, replacement: `${path.resolve(__dirname, '../packages/audio/src/index.ts')}` },
      { find: /^@advjs\/assets$/, replacement: `${path.resolve(__dirname, '../packages/assets/src/index.ts')}` },
      { find: '@/', replacement: `${path.resolve(__dirname, 'theme')}/` },
      { find: 'advjs/', replacement: `${path.resolve(__dirname, '../../packages/advjs')}/` },
    ],
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
})
