import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'music-workflow.spec.ts',
  tsconfig: '../fixtures/music/tsconfig.json',
  outputDir: process.env.ADVJS_STUDIO_MUSIC_EVIDENCE ?? '../../../../test-results/studio-music-workflow',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4196', locale: 'zh-CN', trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 15_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['iPhone 13'] } }],
  webServer: { cwd: resolve(import.meta.dirname, '../..'), command: '../../node_modules/.bin/vite preview --host 127.0.0.1 --port 4196 --strictPort', url: 'http://127.0.0.1:4196', reuseExistingServer: false },
})
