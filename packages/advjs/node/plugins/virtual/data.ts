import type { VirtualModuleTemplate } from './types'

export const templateData: VirtualModuleTemplate = {
  /**
   * work: declare module '@advjs:data'
   * not work: declare module `/@advjs:data`
   */
  id: '@advjs:data',
  async getContent({ data }) {
    return `export default ${JSON.stringify(data)}`
  },
}
