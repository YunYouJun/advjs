import type { VirtualModuleTemplate } from './types'
import { toPlayerData } from '../config/player'

export const templateData: VirtualModuleTemplate = {
  id: '/@advjs/data',
  async getContent({ data, mode }) {
    const playerData = data ? toPlayerData(data) : data
    return `export default ${JSON.stringify(mode === 'build' ? { ...playerData, configFile: '', gameConfigFile: '', themeConfigFile: '' } : playerData)}`
  },
}
