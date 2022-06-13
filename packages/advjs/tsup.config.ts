import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'node/index.ts',
    'node/cli.ts',
  ],
  clean: true,
  splitting: true,
  format: ['cjs', 'esm'],
  dts: true,
  external: [
    '@advjs/client/package.json',
  ],
})
