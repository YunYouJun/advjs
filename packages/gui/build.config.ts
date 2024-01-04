import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './client/types/index',
    './node/index',
  ],

  declaration: true,
  // clean: true,
  clean: false,
  rollup: {
    emitCJS: true,
  },
})
