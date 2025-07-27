// bump.config.ts
import { defineConfig } from 'bumpp'

// bumpp --commit --push --tag && pnpm publish
export default defineConfig({
  all: true,
  files: [
    'package.json',
    'packages/*/package.json',
  ],
})
