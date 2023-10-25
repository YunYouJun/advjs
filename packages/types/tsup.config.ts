import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  target: 'node14',
  splitting: true,
  dts: true,
  clean: true,
  shims: false,
  external: [
    'mdast',
    /@advjs/,
  ],
})
