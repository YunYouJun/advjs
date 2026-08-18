import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __DEV__: 'false',
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['test/**/*.test.ts'],
  },
})
