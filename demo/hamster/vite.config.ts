import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { commonAlias } from '../../packages/shared/node'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  resolve: {
    /**
     * Use workspace TypeScript sources while developing ADV.JS itself.
     * Published projects do not need this alias.
     */
    alias: commonAlias,
  },
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
})
