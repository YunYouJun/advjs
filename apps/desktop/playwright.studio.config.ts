import process from 'node:process'
import { defineConfig } from '@playwright/test'

const port = Number(process.env.ADVJS_STUDIO_PORT ?? 4278)
const baseURL = `http://127.0.0.1:${port}`

/** Run against the previously built Studio, without Electron APIs or a Vite dev server. */
export default defineConfig({
  testDir: './test',
  testMatch: 'studio.spec.ts',
  timeout: 90000,
  workers: 1,
  use: { baseURL, channel: process.env.ADVJS_WEB_CHANNEL ?? 'chrome', locale: 'zh-CN', viewport: { width: 390, height: 844 }, actionTimeout: 10000, trace: 'retain-on-failure' },
  reporter: [['list']],
  webServer: {
    command: `pnpm -C ../studio exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: process.env.ADVJS_STUDIO_REUSE_SERVER === '1',
  },
})
