import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './node/index',
    './unocss/index',
  ],

  declaration: true,
  // clean: true,
  clean: false,
  rollup: {
    emitCJS: true,
  },
})
