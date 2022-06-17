import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  entries: [
    'src/index',
    'src/babylon',
  ],
  externals: [
    'fsevents',

    'advjs',
    '@advjs/parser',
    '@advjs/types',
    'pinia',
    'consola',
    'dayjs',
    'vue',
    'html2canvas',

    '@babylonjs/core',
    '@babylonjs/loaders',
    '@babylonjs/materials',
    'babylon-vrm-loader',
    // 'unist',
    'mdast',
    // '@types/unist',
    '@types/mdast',
  ],
})
