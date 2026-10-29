import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const runtime = process.env.STUDIO_CREATIVE_RUNTIME_ROOT
if (!runtime)
  throw new Error('Set STUDIO_CREATIVE_RUNTIME_ROOT to the local YunLeFun/api source checkout')
const quote = (value: string) => `'${value.replaceAll('\'', '\'\\\'\'')}'`
export default defineConfig({
  testDir: '.',
  testMatch: 'creative-runtime.spec.ts',
  outputDir: process.env.ADVJS_CREATIVE_TEAM_EVIDENCE || mkdtempSync(resolve(tmpdir(), 'advjs-creative-runtime-e2e-')),
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4204', locale: 'zh-CN', trace: 'off', video: 'off', screenshot: 'only-on-failure', actionTimeout: 15000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { cwd: resolve(import.meta.dirname, '../../../..'), command: `node scripts/run-studio-runtime-fixture.mjs --runtime=${quote(runtime)}`, url: 'http://127.0.0.1:4205/health', reuseExistingServer: false, timeout: 30000 },
    { cwd: resolve(import.meta.dirname, '../..'), command: 'pnpm exec vite --config tests/fixtures/creative-team/runtime.vite.config.ts', url: 'http://127.0.0.1:4204', reuseExistingServer: false, timeout: 60000 },
  ],
})
