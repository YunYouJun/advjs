import type { VirtualModuleTemplate } from './types'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { toAtFS } from '../../resolver'

function createSetupTemplate(name: string): VirtualModuleTemplate {
  return {
    id: `/@advjs/setups/${name}`,
    getContent({ roots }) {
      const setups = roots
        .flatMap((i) => {
          const path = join(i, 'setups', name)
          return ['.ts', '.js'].map(ext => path + ext)
        })
        .filter(i => existsSync(i))

      const imports: string[] = []

      setups.forEach((path, idx) => {
        imports.push(`import __n${idx} from '${toAtFS(path)}'`)
      })

      imports.push(`export default [${setups.map((_, idx) => `__n${idx}`).join(',')}]`)

      return imports.join('\n')
    },
  }
}

// setups
const setupModules = ['main', 'adv']

export const templateSetups = setupModules.map(createSetupTemplate)
