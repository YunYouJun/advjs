import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
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
    'vue-demi',
    '@vueuse/core',
    'pinia',

    'html2canvas',
    'unstorage',
  ],
})
