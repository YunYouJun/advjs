import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: ['managed-session.spec.ts', 'host-identity.spec.ts'],
  outputDir: process.env.ADVJS_CREATIVE_TEAM_EVIDENCE || mkdtempSync(resolve(tmpdir(), 'advjs-managed-session-e2e-')),
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4203', trace: 'off', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { cwd: resolve(import.meta.dirname, '../..'), command: 'pnpm exec vite --config tests/fixtures/creative-team/managed-session.vite.config.ts', url: 'http://127.0.0.1:4203', reuseExistingServer: false, timeout: 60000 },
})
