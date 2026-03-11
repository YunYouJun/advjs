import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    'client/index',
  ],
  clean: true,
  externals: [
    'advjs',
    '@advjs/client',
    '@advjs/core',
    '@advjs/shared',
    '@advjs/types',

    'vue',

    // advjs child deps
    'defu',
  ],
  rollup: {
    inlineDependencies: [
      '@antfu/utils',
    ],
  },
})
