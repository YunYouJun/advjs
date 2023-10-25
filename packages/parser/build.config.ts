import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    'src/core',
    'src/fs',
  ],
  clean: true,
  externals: [
    'mdast',
    ...Object.keys(pkg.dependencies),
  ],
})
