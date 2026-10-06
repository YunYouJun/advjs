import type { VirtualModuleTemplate } from './types'

export const templateData: VirtualModuleTemplate = {
  id: '/@advjs/data',
  async getContent({ data, mode }) {
    return `export default ${JSON.stringify(mode === 'build' ? { ...data, configFile: '', gameConfigFile: '', themeConfigFile: '' } : data)}`
  },
}
