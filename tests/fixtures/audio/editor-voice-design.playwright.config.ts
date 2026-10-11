import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  testMatch: ['editor-voice-design.spec.ts'],
  outputDir: fileURLToPath(new URL('../../../test-results/editor-voice-design', import.meta.url)),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
