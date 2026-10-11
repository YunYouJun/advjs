import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  testMatch: 'editor-native-flow.spec.ts',
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  outputDir: join(tmpdir(), 'advjs-editor-native-flow-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180000,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
