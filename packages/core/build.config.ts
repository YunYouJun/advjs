import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index'],
  externals: [
    'advjs',
    '@advjs/parser',
    '@advjs/types',
    'pinia',
    'consola',
    'dayjs',
    'vue',
    'html2canvas',
  ],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
