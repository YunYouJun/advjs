import type { VirtualModuleTemplate } from './types'

export const templateData: VirtualModuleTemplate = {
  id: '/@advjs/data',
  async getContent({ data }) {
    return `export default ${JSON.stringify(data)}`
  },
}
