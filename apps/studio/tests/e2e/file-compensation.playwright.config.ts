import { defineConfig } from '@playwright/test'
import creativeConfig from './creative-team.playwright.config'

export default defineConfig({ ...creativeConfig, testMatch: 'file-compensation.spec.ts' })
