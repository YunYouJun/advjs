import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const enabled = process.env.ADVJS_REAL_QWEN === '1'
export default defineConfig({
  testDir: '.',
  testMatch: 'real-qwen*.spec.ts',
  timeout: 40 * 60 * 1000,
  expect: { timeout: 30000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: fileURLToPath(new URL('../../../../test-results/studio-real-qwen', import.meta.url)),
  // Pairing capabilities must never enter an archived browser trace.
  use: { baseURL: 'http://127.0.0.1:3396', locale: 'zh-CN', trace: 'off' },
  projects: [
    { name: 'chromium-real-qwen', testMatch: 'real-qwen.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-real-qwen-replay', testMatch: 'real-qwen-replay.spec.ts', dependencies: ['chromium-real-qwen'], use: { ...devices['Desktop Safari'] } },
  ],
  webServer: enabled ? { command: 'pnpm exec vite --config apps/studio/tests/fixtures/real-qwen/vite.config.ts', cwd: fileURLToPath(new URL('../../../..', import.meta.url)), url: 'http://127.0.0.1:3396', reuseExistingServer: false, timeout: 180000 } : undefined,
})
