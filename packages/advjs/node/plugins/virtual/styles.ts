import type { VirtualModuleTemplate } from './types'
import { existsSync } from 'node:fs'

import { join } from 'node:path'
import { toAtFS } from '../../resolver'

export const templateStyles: VirtualModuleTemplate = {
  id: '/@advjs/styles',
  async getContent({ roots }) {
    const imports: string[] = []

    for (const root of roots) {
      const styles = [
        join(root, 'styles', 'index.ts'),
        join(root, 'styles', 'index.css'),
        join(root, 'styles', 'index.scss'),
      ]

      for (const style of styles) {
        if (existsSync(style)) {
          imports.push(`import "${toAtFS(style)}"`)
          continue
        }
      }
    }

    return imports.join('\n')
  },
}
