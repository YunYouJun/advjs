import process from 'node:process'
import Vue from '@vitejs/plugin-vue'
import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
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
