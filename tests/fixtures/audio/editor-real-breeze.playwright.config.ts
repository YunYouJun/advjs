import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  testMatch: 'editor-real-breeze.spec.ts',
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  outputDir: join(tmpdir(), 'advjs-editor-real-breeze-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 12 * 60_000,
  expect: { timeout: 60_000 },
  reporter: 'list',
  use: { trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
