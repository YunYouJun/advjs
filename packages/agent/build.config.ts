import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: [
    'src/index',
    'src/byok-dev/index',
  ],
  clean: true,
  externals: [
    '@advjs/core',
    '@advjs/types',
  ],
})
