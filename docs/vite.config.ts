import path from 'node:path'
import { getViteConfig } from '@yunyoujun/docs'

import { defineConfig } from 'vite'

// import { componentsDir } from '@advjs/gui/node'
// no compile
import { componentsDir } from '../packages/gui/node'

const viteConfig = getViteConfig({
  componentsDirs: [
    componentsDir,
  ],
})

export default defineConfig({
  ...viteConfig,

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
})
