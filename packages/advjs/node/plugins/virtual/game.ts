import type { VirtualModuleTemplate } from './types'
import { join } from 'node:path'
import fs from 'fs-extra'
import { toAtFS } from '../../resolver'

function createGameTemplate(name: string): VirtualModuleTemplate {
  return {
    id: `/@advjs/game/${name}`,
    async getContent({ userRoot, data }) {
      const root = join(userRoot, data.config.root || 'adv', name)
      const files = (await fs.readdir(root)).filter(i => i.endsWith(`.${name}.ts`))

      const imports: string[] = []
      files.forEach((path, idx) => {
        imports.push(`import __${name}_${idx} from '${toAtFS(path)}'`)
      })

      imports.push(`export default [${files.map((_, idx) => `__n${idx}`).join(',')}]`)
      return imports.join('\n')
    },
  }
}

// games
const gameModules = [
  'characters',
  'chapters',
  'scenes',
]

export const templateGames = gameModules.map(createGameTemplate)
