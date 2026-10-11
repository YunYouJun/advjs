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
      '@advjs/editor-sdk': fileURLToPath(new URL('./packages/editor-sdk/src/index.ts', import.meta.url)),
      '@advjs/audio': fileURLToPath(new URL('./packages/audio/src/index.ts', import.meta.url)),
      '@advjs/parser': fileURLToPath(new URL('./packages/parser/src/index.ts', import.meta.url)),
      '@advjs/types': fileURLToPath(new URL('./packages/types/src/index.ts', import.meta.url)),
      '@advjs/assets': fileURLToPath(new URL('./packages/assets/src/index.ts', import.meta.url)),
      '@advjs/template': fileURLToPath(new URL('./packages/advjs/template', import.meta.url)),
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
    // Electron uses Playwright/node:test (including out/); Studio has its own Vite config.
    exclude: [...defaultExclude, '**/e2e/**', 'apps/desktop/**', 'apps/studio/**'],
    // Several launch tests build and package the same workspace artifacts.
    // Running test files concurrently races on dist/ and Nuxt's build lock.
    fileParallelism: false,

    reporters: [process.env.CI ? ['html', { outputDir: 'vitest-report' }] : 'default'],

    environment: 'jsdom',
  },

  plugins: [
    Vue(),
  ],
})
