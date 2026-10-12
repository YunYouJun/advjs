import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  testMatch: 'editor-music.spec.ts',
  outputDir: process.env.ADVJS_MUSIC_EDITOR_EVIDENCE || fileURLToPath(new URL('../../../test-results/editor-music', import.meta.url)),
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: 'list',
  use: { trace: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }],
})
