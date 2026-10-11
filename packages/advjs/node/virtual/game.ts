import type { AdvCharacter } from '@advjs/types'
import type { VirtualModuleTemplate } from './types'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { projectRuntimeCharacter } from '@advjs/audio'
import { gameModules } from '../../shared'
import { toAtFS } from '../resolver'
import { loadModule } from '../utils'
import { pathExists } from '../utils/fs'

function createGameTemplate(name: string): VirtualModuleTemplate {
  return {
    id: `/@advjs/game/${name}s`,
    async getContent({ gameRoot, data }) {
      // Canonical project chapters are already validated and projected by the
      // shared compiler. Retained legacy modules are author history, not a
      // second player source or browser-executed fallback.
      if (data?.gameConfig.chapters?.length) {
        const collection = data.gameConfig[`${name}s` as 'chapters' | 'characters' | 'scenes']
        if (Array.isArray(collection))
          return `export default ${JSON.stringify(collection)}`
      }
      const root = join(gameRoot, `${name}s`)
      if (!(await pathExists(root))) {
        return `export default []`
      }
      /**
       * 按数字顺序排序
       */
      const files = (await readdir(root)).filter(i => i.endsWith(`.${name}.ts`)).sort((a, b) => {
        const numA = Number.parseInt(a.split('.')[0])
        const numB = Number.parseInt(b.split('.')[0])
        return numA - numB
      }).map(i => join(root, i))

      if (name === 'character') {
        // Evaluate authoring modules only on the Node host. A browser import of
        // the original module would publish private profiles even if its export
        // were filtered afterwards. Keep file watches for local edits/HMR.
        const characters = await Promise.all(files.map(async (file) => {
          this.addWatchFile(file)
          const character = await loadModule<{ default: AdvCharacter }>(file)
          return projectRuntimeCharacter(character.default)
        }))
        return `export default ${JSON.stringify(characters)}`
      }

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

export type AdvGameModuleName = typeof gameModules[number]

export const templateGames = gameModules.map(createGameTemplate)
