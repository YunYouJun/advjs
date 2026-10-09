import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: [
    'src/index',
    { input: 'src/runtime/headless', name: 'runtime' },
    { input: 'src/compiler/index', name: 'compiler' },
  ],
  clean: true,
  externals: [
    'advjs',
    '@advjs/assets',
    '@advjs/parser',
    '@advjs/types',
    'consola',
    'unstorage',

    // vue
    'vue',
  ],
})
