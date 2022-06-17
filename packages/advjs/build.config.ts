import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  entries: [
    'node/index',
    'node/cli',
  ],
  externals: [
    '@advjs/client',
    'fsevents',
    'semver',
  ],
})
