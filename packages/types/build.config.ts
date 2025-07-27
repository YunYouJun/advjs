import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

export default defineBuildConfig({
  declaration: 'node16',
  entries: [
    'src/index',
  ],
  clean: true,

  externals: [
    'mdast',

    '@vueuse/core',
    '@vueuse/shared',

    /@advjs/,
    '@advjs/client',

    'vfile',

    ...Object.keys(pkg.peerDependencies),
  ],
})
