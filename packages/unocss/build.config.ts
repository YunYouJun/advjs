import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: ['src/index'],
  externals: ['unocss'],
  clean: true,
})
