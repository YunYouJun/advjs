import type { VirtualModuleTemplate } from './types'
import { join } from 'node:path'
import fs from 'fs-extra'
import { toAtFS } from '../../resolver'

function createGameTemplate(name: string): VirtualModuleTemplate {
  return {
    id: `/@advjs/game/${name}s`,
    async getContent({ userRoot, data }) {
      const root = join(userRoot, data.config.root || 'adv', `${name}s`)
      /**
       * 按数字顺序排序
       */
      const files = (await fs.readdir(root)).filter(i => i.endsWith(`.${name}.ts`)).sort((a, b) => {
        const numA = Number.parseInt(a.split('.')[0])
        const numB = Number.parseInt(b.split('.')[0])
        return numA - numB
      }).map(i => join(root, i))

      const imports: string[] = []
      /**
       * get imported name
       * @param idx
       */
      const getImportedName = (idx: number) => `__adv_${name}_${idx}`
      files.forEach((path, idx) => {
        imports.push(`import ${getImportedName(idx)} from '${toAtFS(path)}'`)
      })

      imports.push(`export default [${files.map((_, idx) => getImportedName(idx)).join(',')}]`)
      return imports.join('\n')
    },
  }
}

// games
const gameModules = [
  'chapter',
  'character',
  'scene',
]

export const templateGames = gameModules.map(createGameTemplate)
