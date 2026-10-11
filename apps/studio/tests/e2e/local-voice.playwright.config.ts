import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'local-voice.spec.ts',
  // Use the real packaged Node API; monorepo source aliases require Vite's
  // JSON loader and are inappropriate for Playwright's Node host.
  tsconfig: '../fixtures/local-voice/tsconfig.json',
  outputDir: '../../../../test-results/studio-local-voice',
  workers: 1,
  reporter: 'list',
  // A pairing credential must never be copied into a Playwright trace/video.
  use: { baseURL: 'http://127.0.0.1:4193', locale: 'zh-CN', trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 15_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: 'pnpm preview --host 127.0.0.1 --port 4193 --strictPort', url: 'http://127.0.0.1:4193', reuseExistingServer: false },
})
