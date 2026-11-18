import { defineConfig, devices } from '@playwright/test'
import creativeConfig from './creative-team.playwright.config'

export default defineConfig({
  ...creativeConfig,
  testMatch: 'memory-fs.spec.ts',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
