import process from 'node:process'
import { defineConfig } from '@playwright/test'

/** Local Editor regressions use their own Bridge fixtures, without demo servers. */
export default defineConfig({ testDir: '../../tests/e2e', testMatch: ['editor-local.spec.ts', 'editor-recovery.spec.ts'], timeout: 90000, workers: 1, use: { browserName: 'chromium', channel: process.env.ADVJS_WEB_CHANNEL ?? 'chromium', trace: 'retain-on-failure' }, outputDir: './test-results/web', reporter: [['list']] })
