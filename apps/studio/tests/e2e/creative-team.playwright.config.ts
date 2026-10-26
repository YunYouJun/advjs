import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'creative-team.spec.ts',
  outputDir: process.env.ADVJS_CREATIVE_TEAM_EVIDENCE || mkdtempSync(resolve(tmpdir(), 'advjs-creative-team-e2e-')),
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4198', locale: 'zh-CN', trace: 'off', video: 'off', screenshot: 'only-on-failure', actionTimeout: 15000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    cwd: resolve(import.meta.dirname, '../..'),
    command: 'pnpm exec vite --config tests/fixtures/creative-team/vite.config.ts',
    url: 'http://127.0.0.1:4198',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
