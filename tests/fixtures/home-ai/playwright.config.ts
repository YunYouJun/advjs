import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3374'

export default defineConfig({
  testDir: '.',
  testMatch: 'endless-tram.spec.ts',
  timeout: 60_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 8_000,
    baseURL,
    locale: 'zh-CN',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite preview --outDir docs/.vitepress/dist --host 127.0.0.1 --port 3374 --strictPort',
    cwd: fileURLToPath(new URL('../../..', import.meta.url)),
    url: baseURL,
    reuseExistingServer: false,
  },
})
