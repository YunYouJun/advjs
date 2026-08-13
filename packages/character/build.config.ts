import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

export default defineBuildConfig({
  entries: ['src/index'],
  clean: true,
  declaration: 'node16',
  externals: Object.keys(pkg.dependencies),
})
