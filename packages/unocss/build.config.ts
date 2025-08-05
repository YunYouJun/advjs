import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: 'node16',
  entries: ['src/index'],
  externals: ['defu', 'unocss'],
  clean: true,
})
