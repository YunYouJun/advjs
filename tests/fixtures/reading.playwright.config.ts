import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(new URL('../e2e', import.meta.url)),
  testMatch: 'game-ui.spec.ts',
  grep: /keeps dialogue reading sizes and multiline text/,
  outputDir: join(tmpdir(), 'advjs-game-reading-results'),
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: 'list',
  use: { locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm -C demo/flow run dev --port 3362',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: 'http://127.0.0.1:3362',
    reuseExistingServer: false,
  },
})
