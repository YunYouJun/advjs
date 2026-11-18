import { defineConfig } from '@playwright/test'
import memoryConfig from './memory-fs.playwright.config'

export default defineConfig({ ...memoryConfig, testMatch: 'form-saving.spec.ts' })
