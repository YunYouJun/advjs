import { defineConfig } from '@playwright/test'
import memoryConfig from './memory-fs.playwright.config'

export default defineConfig({ ...memoryConfig, testMatch: 'audio-transactions.spec.ts', projects: memoryConfig.projects!.map(project => project.name === 'webkit' ? { ...project, grep: /memory/ } : project) })
