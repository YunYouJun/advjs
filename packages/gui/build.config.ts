import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './client/types/index',
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
