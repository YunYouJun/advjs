import type { VirtualModuleTemplate } from './types'

export const templateData: VirtualModuleTemplate = {
  id: '/@advjs/data',
  async getContent({ data, mode }) {
    const { authoring: _authoring, ...config } = data?.config ?? {}
    const playerData = data ? { ...data, config } : data
    return `export default ${JSON.stringify(mode === 'build' ? { ...playerData, configFile: '', gameConfigFile: '', themeConfigFile: '' } : playerData)}`
  },
}
