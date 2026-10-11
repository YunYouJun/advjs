import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: ['src/index', 'src/voice'],
  clean: true,
  externals: ['@advjs/types', 'openai', 'pathe'],
})
