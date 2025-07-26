import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/fs',
  ],
  clean: true,
  declaration: 'node16',
  externals: [
    // @types/mdast
    'mdast',
    ...Object.keys(pkg.dependencies),
  ],
})
