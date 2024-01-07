import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

import { ADV_VIRTUAL_MODULES } from './node/config'

// eslint-disable-next-line no-console
console.log('debugger entries')

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

    ...ADV_VIRTUAL_MODULES,
  ],
})
