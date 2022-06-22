import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core.ts',
    'src/fs.ts',
  ],
  clean: true,
  // not use for dynamic 'import' in cjs
  // splitting: true,
  format: ['cjs', 'esm'],
  dts: true,
  target: 'node16',
  shims: false,
})
