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
    'html2canvas',
    'unstorage',
  ],
})
