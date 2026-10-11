import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/** Each test serves the real production Editor through its scoped local bridge. */
export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  testMatch: ['editor-audio-workspace.spec.ts', 'editor-voice-jobs.spec.ts', 'editor-audio-profiles.spec.ts'],
  outputDir: fileURLToPath(new URL('../../../test-results/editor-audio', import.meta.url)),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
