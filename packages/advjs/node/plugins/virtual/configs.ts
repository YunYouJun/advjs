import type { VirtualModuleTemplate } from './types'
import defu from 'defu'

function createConfigTemplate(name: string): VirtualModuleTemplate {
  return {
    /**
     * work: declare module '@advjs/configs/adv'
     * not work: declare module `/@advjs/configs/adv`
     */
    id: `@advjs/configs/${name}`,
    getContent({ data, remote }) {
      // front override latter
      const config = defu({ ...data?.config, remote })

      return `export default ${JSON.stringify(config)}`
    },
  }
}

/**
 * adv.config.ts
 */
const configs = [
  'adv',
  'app',
  'theme',
]

export const templateConfigs = configs.map(createConfigTemplate)
