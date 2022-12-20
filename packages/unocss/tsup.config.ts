import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  external: ['defu', 'unocss'],
  clean: true,
  splitting: true,
  format: ['cjs', 'esm'],
  dts: true,
})
