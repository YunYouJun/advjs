import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const enabled = process.env.ADVJS_REAL_QWEN === '1' && Boolean(process.env.ADVJS_REAL_QWEN_STUDIO_REPLAY)
export default defineConfig({
  testDir: '.',
  testMatch: 'real-qwen-replay.spec.ts',
  timeout: 120000,
  expect: { timeout: 30000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: fileURLToPath(new URL('../../../../test-results/studio-real-qwen-recovery', import.meta.url)),
  use: { baseURL: 'http://127.0.0.1:3396', locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-real-qwen-recovery', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-real-qwen-recovery', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: enabled ? { command: 'pnpm exec vite --config apps/studio/tests/fixtures/real-qwen/vite.config.ts', cwd: fileURLToPath(new URL('../../../..', import.meta.url)), url: 'http://127.0.0.1:3396', reuseExistingServer: false, timeout: 180000 } : undefined,
})
