import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  testMatch: 'editor-real-qwen.spec.ts',
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  outputDir: join(tmpdir(), 'advjs-editor-real-qwen-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
