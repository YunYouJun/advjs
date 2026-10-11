import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { cosReplayPublicationFile } from './cos-replay-config'

const receipt = cosReplayPublicationFile(process.env)

export default defineConfig({
  testDir: '../../e2e',
  testMatch: 'cos-qwen-replay.spec.ts',
  tsconfig: fileURLToPath(new URL('./cos-replay-node.tsconfig.json', import.meta.url)),
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: fileURLToPath(new URL(`../../../test-results/cos-qwen-replay-${Date.now()}`, import.meta.url)),
  use: { locale: 'zh-CN', trace: 'off', video: 'off', screenshot: 'off', serviceWorkers: 'block' },
  projects: [
    { name: 'chromium-real-cos', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-real-cos', use: { ...devices['Desktop Safari'] } },
  ],
  metadata: { mode: 'real-public-cos-existing-local-qwen-replay', receiptConfigured: Boolean(receipt), newModelCalls: 0, remoteWrites: 0 },
})
