import type { AdvChapter, AdvCharacter, AdvGameConfig, AdvScene } from '@advjs/types'
import type { ResolvedAdvOptions } from '../options'
import type { AdvGameModuleName } from '../virtual/game'
import path from 'node:path'
import { loadConfig } from 'c12'
import fs from 'fs-extra'
import { loadModule } from '../utils'

/**
 * load game.config.ts
 */
export async function loadAdvGameConfig() {
  const { config: gameConfig, configFile: gameConfigFile } = await loadConfig<AdvGameConfig>({
    name: 'game',
  })

  return {
    gameConfig,
    gameConfigFile,
  }
}

export interface GameTypeConfig {
  scene: AdvScene
  chapter: AdvChapter
  character: AdvCharacter
}

export type AdvGameTypeConfig = {
  [K in AdvGameModuleName]: GameTypeConfig[K][]
}

/**
 * load config
 *
 * - adv/scenes
 * - adv/chapters
 * - adv/characters
 */
export async function loadAdvGameConfigFromType<T extends AdvGameModuleName>(type: T, options: ResolvedAdvOptions): Promise<GameTypeConfig[T][]> {
  const root = path.resolve(options.gameRoot, `${type}s`)
  /**
   * 按数字顺序排序
   */
  const files = (await fs.readdir(root)).filter(i => i.endsWith(`.${type}.ts`)).sort((a, b) => {
    const numA = Number.parseInt(a.split('.')[0])
    const numB = Number.parseInt(b.split('.')[0])
    return numA - numB
  }).map(i => path.join(root, i))

  const imports: any[] = []

  await Promise.all(
    files.map(async (file) => {
      const data = (await loadModule(file)) as { default: GameTypeConfig[T] }
      imports.push(data.default)
    }),
  )

  return imports
}
