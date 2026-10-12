import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import base from './audio.playwright.config'

export default defineConfig({
  ...base,
  tsconfig: fileURLToPath(new URL('../../../../tests/fixtures/audio/published-flow.tsconfig.json', import.meta.url)),
  testMatch: ['audio-listening.spec.ts'],
  outputDir: process.env.ADVJS_LISTENING_STUDIO_EVIDENCE || base.outputDir,
  webServer: { ...base.webServer as object, url: 'http://127.0.0.1:4191', cwd: fileURLToPath(new URL('../..', import.meta.url)), command: './node_modules/.bin/vite preview --host 127.0.0.1 --port 4191 --strictPort' },
  fullyParallel: false,
  workers: 1,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4191', trace: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['iPhone 13'] } }],
})
