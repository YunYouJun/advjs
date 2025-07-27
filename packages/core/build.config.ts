import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: [
    'src/index',
  ],
  clean: true,
  externals: [
    'advjs',
    '@advjs/parser',
    '@advjs/types',
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
