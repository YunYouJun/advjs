import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'audio-management.spec.ts',
  outputDir: '../../../../test-results/studio-audio',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4190', locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm preview --host 127.0.0.1 --port 4190 --strictPort', url: 'http://127.0.0.1:4190', reuseExistingServer: false },
})
