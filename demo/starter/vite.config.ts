import { defineConfig } from 'vite'
import { commonAlias } from '../../packages/shared/node'

export default defineConfig({
  resolve: {
    /**
     * for advjs dev to use ts directly
     * If you are user, you don't need this.
     */
    alias: commonAlias,
  },
})
