import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { readStudioCloudAudioGate } from '../fixtures/cloud-audio/config'

const gate = readStudioCloudAudioGate(process.env)

export default defineConfig({
  testDir: '.',
  testMatch: 'cloud-audio.spec.ts',
  tsconfig: fileURLToPath(new URL('../fixtures/cloud-audio/node.tsconfig.json', import.meta.url)),
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  outputDir: fileURLToPath(new URL('../../../../test-results/studio-cloud-audio', import.meta.url)),
  use: {
    ...(gate.enabled ? { baseURL: gate.target.studioUrl, storageState: gate.target.storageState } : {}),
    locale: 'zh-CN',
    // Authenticated traces/HAR/storage snapshots can contain session credentials.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    serviceWorkers: 'block',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: 'chromium-cloud-audio', use: { ...devices['Desktop Chrome'] } }],
  // The remote service and deployed Studio must already exist. No fake server,
  // local provider factory, model setup, tunnel or deployment is started here.
})
