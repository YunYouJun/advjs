import { defineConfig } from 'vite'
import { commonAlias } from '../../packages/shared/node'

export default defineConfig({
  resolve: {
    /**
     * Use workspace TypeScript sources while developing ADV.JS itself.
     * Published projects do not need this alias.
     */
    alias: commonAlias,
  },
})
