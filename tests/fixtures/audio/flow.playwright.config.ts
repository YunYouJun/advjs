import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  testMatch: 'native-flow-project.spec.ts',
  outputDir: join(tmpdir(), 'advjs-flow-production-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3359', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 3359 --strictPort',
    cwd: fileURLToPath(new URL('../../../demo/flow', import.meta.url)),
    url: 'http://127.0.0.1:3359',
    reuseExistingServer: false,
  },
})
