import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({ testDir: '.', testMatch: 'design-flow.spec.ts', workers: 1, reporter: 'list', outputDir: fileURLToPath(new URL('../../../../test-results/studio-design-flow', import.meta.url)), use: { baseURL: 'http://127.0.0.1:3392', locale: 'zh-CN', trace: 'retain-on-failure' }, projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }], webServer: { command: 'pnpm exec vite --config apps/studio/tests/fixtures/design-flow/vite.config.ts', cwd: fileURLToPath(new URL('../../../..', import.meta.url)), url: 'http://127.0.0.1:3392', reuseExistingServer: false, timeout: 60000 } })
