import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
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
    'pixi.js',
  ],
})
