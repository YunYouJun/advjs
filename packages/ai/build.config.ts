import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    { input: 'src/node', name: 'node' },
  ],
  clean: true,
  declaration: 'node16',
  externals: ['@advjs/types'],
})
