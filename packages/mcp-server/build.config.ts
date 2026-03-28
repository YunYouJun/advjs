import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: [
    'src/index',
  ],
  clean: true,
  externals: [
    '@modelcontextprotocol/sdk',
    '@advjs/parser',
    'advjs',
  ],
})
