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
    'unstorage',

    // vue
    'vue',
  ],
})
