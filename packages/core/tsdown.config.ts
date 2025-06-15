import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  clean: true,
  dts: true,
  external: [
    'advjs',
    '@advjs/types',
    '@advjs/parser',
    'consola',

    'dayjs',
    'howler',

    // vue
    'vue',
    '@vueuse/core',
    'pinia',

    'html2canvas',
  ],
})
