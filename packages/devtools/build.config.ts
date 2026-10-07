import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/vite',
    'src/devframe',
  ],
  externals: [
    'vite',
    // Type only
    'vue',
    'vue-router',
    'unstorage',
    'nitropack',
  ],
})
