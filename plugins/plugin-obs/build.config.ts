import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  clean: true,

  externals: [
    'advjs',
    '@advjs/client',
    '@advjs/core',
    '@advjs/shared',
    '@advjs/types',

    'vue',
    'pinia',
  ],
})
