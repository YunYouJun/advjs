import type { VirtualModuleTemplate } from './types'
import { createProjectDataModule } from './project'

export const templateData: VirtualModuleTemplate = {
  id: '/@advjs/data',
  async getContent(options) {
    return await createProjectDataModule(options, this)
      ?? `export default ${JSON.stringify(options.data)}`
  },
}
