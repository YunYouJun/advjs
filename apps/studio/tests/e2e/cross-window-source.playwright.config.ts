import { defineConfig } from '@playwright/test'
import memoryConfig from './memory-fs.playwright.config'

export default defineConfig({ ...memoryConfig, testMatch: 'cross-window-source.spec.ts' })
