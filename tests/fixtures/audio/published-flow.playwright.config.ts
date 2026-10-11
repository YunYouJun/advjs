import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  testMatch: 'published-flow-player.spec.ts',
  // Exercise built package exports, without the repository's source aliases.
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  outputDir: join(tmpdir(), 'advjs-published-flow-production-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
