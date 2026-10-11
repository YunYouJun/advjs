import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'voice-service.spec.ts',
  workers: 1,
  reporter: 'list',
  outputDir: fileURLToPath(new URL('../../../../test-results/studio-voice-service', import.meta.url)),
  use: { baseURL: 'http://127.0.0.1:3388', locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }],
  webServer: { command: 'pnpm exec vite --config apps/studio/tests/fixtures/voice-service/vite.config.ts', cwd: fileURLToPath(new URL('../../../..', import.meta.url)), url: 'http://127.0.0.1:3388', reuseExistingServer: false, timeout: 60000, env: { VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' } },
})
