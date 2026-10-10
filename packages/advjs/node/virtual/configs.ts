import type { VirtualModuleTemplate } from './types'
import defu from 'defu'
import { toPlayerConfig } from '../config/player'

function createConfigTemplate(name: string): VirtualModuleTemplate {
  return {
    /**
     * work: declare module '@advjs/configs/adv'
     * not work: declare module `/@advjs/configs/adv`
     */
    id: `@advjs/configs/${name}`,
    getContent({ data, remote }) {
      // front override latter
      const playerConfig = toPlayerConfig(data?.config ?? {})
      const config = defu({ ...playerConfig, remote })

      return `export default ${JSON.stringify(config)}`
    },
  }
}

/**
 * adv.config.ts
 */
const configs = [
  'adv',
  'game',
  'theme',
]

export const templateConfigs = configs.map(createConfigTemplate)
