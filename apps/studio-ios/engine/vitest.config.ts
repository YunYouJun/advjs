import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const repoRoot = resolve(import.meta.dirname, '../../..')

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    // Workspace sources, never stale dist builds: the same code the bundle contains.
    alias: [
      { find: /^@advjs\/core\/(project|compiler)$/u, replacement: `${repoRoot}/packages/core/src/$1/index.ts` },
      { find: /^@advjs\/core\/runtime$/u, replacement: `${repoRoot}/packages/core/src/runtime/headless.ts` },
      { find: /^@advjs\/plugin-interactions$/u, replacement: `${repoRoot}/plugins/plugin-interactions/src/index.ts` },
      { find: /^@advjs\/([\w-]+)$/u, replacement: `${repoRoot}/packages/$1/src/index.ts` },
    ],
  },
  test: {
    name: 'studio-ios-engine',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 120_000,
  },
})
