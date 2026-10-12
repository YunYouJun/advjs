import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: ['src/index', 'src/testing'],
  clean: true,
  externals: ['@advjs/types', '@advjs/assets'],
})
