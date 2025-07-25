import type { Argv } from 'yargs'
import path from 'node:path'
import process from 'node:process'
import { gameModules } from '@advjs/core'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import fs from 'fs-extra'
import { loadAdvGameConfigFromType } from '../config/game'
import { resolveOptions } from '../options'
import { commonOptions } from './utils'

/**
 * merge config to a single file
 *
 * .adv.json
 */
export function installConfigCommand(cli: Argv) {
  cli.command(
    'config',
    'Merge Config to a single file',
    args =>
      commonOptions(args)
        .option('merge', {
          alias: 'm',
          default: true,
          describe: 'merge config to a single file',
          type: 'boolean',
        })
        // target directory
        .option('target', {
          alias: 't',
          default: 'public',
          describe: 'target directory',
          type: 'string',
        })
        // 图片转换成 base64
        .option('base64', {
          alias: 'b',
          default: false,
          describe: 'convert image to base64',
          type: 'boolean',
        }),
    async ({ target, base64 }) => {
      consola.start('Resolving options...')
      const options = await resolveOptions({}, 'build')
      const { gameConfig } = options.data

      for (const gameModule of gameModules) {
        const gameConfigName = `${gameModule}s` as const
        gameConfig[gameConfigName] = await loadAdvGameConfigFromType(gameModule, options) as any
      }

      if (base64) {
        const publicPath = path.resolve(options.userRoot, 'public')
        function imgToBase64(src: string) {
          const srcPath = path.resolve(publicPath, src.startsWith('/') ? src.slice(1) : src)
          if (!fs.existsSync(srcPath)) {
            consola.warn(`Image not found: ${srcPath}`)
            return ''
          }
          const base64Data = fs.readFileSync(srcPath).toString('base64')
          return `data:image/png;base64,${base64Data}`
        }
        gameConfig.scenes.forEach((scene) => {
          if (scene.type === 'image') {
            scene.src = imgToBase64(scene.src)
          }
        })
        gameConfig.characters.forEach((character) => {
          Object.keys(character.tachies || {}).forEach((key) => {
            const tachie = character.tachies?.[key]
            if (!tachie)
              return
            if (tachie.src) {
              tachie.src = imgToBase64(tachie.src)
            }
          })
        })
      }

      const targetDir = path.resolve(process.cwd(), target)
      await fs.ensureDir(targetDir)
      const gameConfigFile = path.resolve(targetDir, `${gameConfig.title}.adv.json`)
      await fs.writeJSON(
        gameConfigFile,
        gameConfig,
        {
          spaces: 2,
        },
      )
      consola.success(`Merged config to ${colors.dim(gameConfigFile)}`)
    },
  )
}
