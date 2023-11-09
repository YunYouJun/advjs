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
    'pinia',
    'consola',
    'dayjs',

    'vue',
    'vue-demi',
    'howler',

    'html2canvas',
    'unstorage',
  ],
})
