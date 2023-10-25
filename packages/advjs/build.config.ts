import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'node/index',
    'node/cli/index',
  ],
  clean: true,

  externals: [
    'mdast',
    ...Object.keys(pkg.dependencies),
  ],
})
