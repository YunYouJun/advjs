import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.STUDIO_E2E_PORT || 4178)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    // Opt in explicitly so an unrelated Vite app on the same port can never
    // make the suite produce false positives.
    reuseExistingServer: process.env.STUDIO_E2E_REUSE_SERVER === '1',
  },
})
