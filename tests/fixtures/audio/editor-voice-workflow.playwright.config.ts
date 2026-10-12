import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  testMatch: ['editor-voice-design.spec.ts'],
  grep: /character voice entry applies a reviewed design/u,
  outputDir: process.env.ADVJS_VOICE_WORKFLOW_EVIDENCE || fileURLToPath(new URL('../../../test-results/editor-voice-workflow', import.meta.url)),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { trace: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }],
})
