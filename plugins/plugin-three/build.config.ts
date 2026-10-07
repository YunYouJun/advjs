import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: ['src/index'],
  clean: true,
  externals: ['three', 'three/addons/controls/OrbitControls.js'],
})
