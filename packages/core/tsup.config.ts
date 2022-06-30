import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/babylon/index.ts',
  ],
  clean: true,
  splitting: true,
  format: ['cjs', 'esm'],
  dts: true,
  external: [
    'advjs',
    '@advjs/parser',
    '@advjs/types',
    'pinia',
    'consola',
    'dayjs',
    'vue',
    'html2canvas',
  ],
})
