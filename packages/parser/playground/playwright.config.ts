import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.ADVJS_PARSER_URL || 'http://127.0.0.1:3457'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.ADVJS_PARSER_URL
    ? undefined
    : {
        command: 'pnpm parser:play:build && pnpm -C packages/parser/playground exec vite preview --host 127.0.0.1 --port 3457 --strictPort',
        cwd: fileURLToPath(new URL('../../..', import.meta.url)),
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
})
