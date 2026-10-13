import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.ADVJS_DEMO_URL || 'http://127.0.0.1:3461'

export default defineConfig({
  testDir: '../e2e',
  testMatch: 'starter.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { baseURL, locale: 'zh-CN', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: {
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  } }],
  webServer: process.env.ADVJS_DEMO_URL
    ? undefined
    : {
        command: 'pnpm -C demo/starter exec vite preview --host 127.0.0.1 --port 3461 --strictPort',
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        url: baseURL,
        timeout: 30_000,
        reuseExistingServer: !process.env.CI,
      },
})
