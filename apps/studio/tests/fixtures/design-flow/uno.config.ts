import { fileURLToPath } from 'node:url'
import { defineConfig } from 'unocss'
import studio from '../../../uno.config'

export default defineConfig({ ...studio, content: { filesystem: [fileURLToPath(new URL('../../../../../packages/client/**/*.{vue,ts}', import.meta.url)), fileURLToPath(new URL('../../../../../themes/theme-default/**/*.{vue,ts}', import.meta.url))] } })
