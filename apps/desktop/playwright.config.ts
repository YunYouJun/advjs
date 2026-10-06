import { defineConfig } from '@playwright/test'

export default defineConfig({ testDir: './test', testMatch: ['desktop.spec.ts', 'preferences.spec.ts', 'startup.spec.ts', 'native-menu.spec.ts'], timeout: 300000, workers: 1, fullyParallel: false, use: { actionTimeout: 10000, trace: 'retain-on-failure' }, reporter: [['list'], ['html', { open: 'never' }]] })
