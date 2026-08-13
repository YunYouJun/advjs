import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __DEV__: 'false',
  },
  resolve: {
    alias: {
      '@advjs/assets': fileURLToPath(new URL('./packages/assets/src/index.ts', import.meta.url)),
      '#advjs/data': fileURLToPath(new URL('./tests/fixtures/adv-data.ts', import.meta.url)),
      '#advjs/game/chapters': fileURLToPath(new URL('./tests/fixtures/empty-list.ts', import.meta.url)),
      '#advjs/game/characters': fileURLToPath(new URL('./tests/fixtures/empty-list.ts', import.meta.url)),
      '#advjs/game/scenes': fileURLToPath(new URL('./tests/fixtures/empty-list.ts', import.meta.url)),
      '#advjs/runtime-plugins': fileURLToPath(new URL('./tests/fixtures/runtime-plugins.ts', import.meta.url)),
      '#advjs/setups/adv': fileURLToPath(new URL('./tests/fixtures/empty-list.ts', import.meta.url)),
      '#advjs/setups/main': fileURLToPath(new URL('./tests/fixtures/empty-list.ts', import.meta.url)),
      '#advjs/styles': fileURLToPath(new URL('./tests/fixtures/empty-list.ts', import.meta.url)),
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
