import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({ entries: ['src/index', 'src/node', 'src/host-protocol'], declaration: 'node16', clean: true, externals: ['vue'] })
