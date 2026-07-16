import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '/@advjs/locales': fileURLToPath(new URL('./tests/fixtures/locales.ts', import.meta.url)),
    },
  },
  test: {
    name: 'advjs',
    exclude: [...defaultExclude, '**/e2e/**'],

    reporters: [process.env.CI ? 'html' : 'default'],
    outputFile: 'vitest-report/index.html',

    environment: 'jsdom',
  },

  plugins: [
    Vue(),
  ],
})
