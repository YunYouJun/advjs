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
    '@advjs/shared',
    '@advjs/types',

    'vue',
  ],
  rollup: {
    inlineDependencies: [
      '@antfu/utils',
    ],
  },
})
