import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  testMatch: 'audio-runtime.spec.ts',
  outputDir: fileURLToPath(new URL('../../../test-results/audio', import.meta.url)),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3347', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm exec vite --config tests/fixtures/audio/vite.config.ts',
    cwd: fileURLToPath(new URL('../../..', import.meta.url)),
    url: 'http://127.0.0.1:3347',
    reuseExistingServer: false,
  },
})
