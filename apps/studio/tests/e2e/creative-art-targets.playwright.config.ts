import { defineConfig } from '@playwright/test'
import memoryConfig from './memory-fs.playwright.config'

export default defineConfig({ ...memoryConfig, testMatch: 'creative-art-targets.spec.ts', timeout: 120000 })
