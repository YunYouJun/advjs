import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: [
    'src/index.ts',
  ],
  clean: true,
  format: ['cjs', 'esm'],
  dts: true,
})
