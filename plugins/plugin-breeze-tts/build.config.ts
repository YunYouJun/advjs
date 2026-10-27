import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: ['src/index'],
  clean: true,
  externals: ['@advjs/types', '@advjs/assets', '@advjs/audio'],
})
