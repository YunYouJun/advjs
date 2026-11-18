import { defineConfig } from '@playwright/test'
import creativeConfig from './creative-team.playwright.config'

export default defineConfig({ ...creativeConfig, testMatch: 'native-write-lock.spec.ts' })
