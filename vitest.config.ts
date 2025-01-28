import process from 'node:process'
import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'advjs',
    exclude: [...defaultExclude, '**/e2e/**'],

    reporters: [process.env.CI ? 'html' : 'default'],
    outputFile: 'vitest-report/index.html',
  },
})
