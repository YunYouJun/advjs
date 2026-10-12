import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'voice-workflow.spec.ts',
  tsconfig: '../fixtures/local-voice/tsconfig.json',
  outputDir: process.env.ADVJS_VOICE_WORKFLOW_EVIDENCE ?? '../../../../test-results/studio-voice-workflow',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4194', locale: 'zh-CN', trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 15_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }],
  webServer: { cwd: resolve(import.meta.dirname, '../..'), command: '../../node_modules/.bin/vite preview --host 127.0.0.1 --port 4194 --strictPort', url: 'http://127.0.0.1:4194', reuseExistingServer: false },
})
