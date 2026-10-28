import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: [
    'src/index',
    'src/byok-dev/index',
    'src/evaluation/index',
    'src/evaluation/node',
  ],
  clean: true,
  externals: [
    '@advjs/core',
    '@advjs/types',
  ],
})
