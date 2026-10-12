import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import { audioBrowserMatrix } from './browser-matrix'

export default defineConfig({
  testDir: '../../e2e',
  testMatch: 'audio-player-parity.spec.ts',
  tsconfig: fileURLToPath(new URL('./published-flow.tsconfig.json', import.meta.url)),
  outputDir: process.env.ADVJS_PLAYER_PARITY_OUTPUT ?? fileURLToPath(new URL('../../../test-results/audio-player-parity', import.meta.url)),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { locale: 'zh-CN', trace: 'off', video: 'off', screenshot: 'off', serviceWorkers: 'block' },
  projects: audioBrowserMatrix(),
  metadata: { physicalDevices: false, newModelCalls: 0, cloudWrites: 0, mode: 'existing-native-production-artifact-replay' },
})
