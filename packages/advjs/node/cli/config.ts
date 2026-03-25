import type { Argv } from 'yargs'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { gameModules } from '../../shared'
import { loadAdvGameConfigFromType } from '../config/game'
import { resolveOptions } from '../options'
import { ensureDir, writeJSON } from '../utils/fs'
import { t } from './i18n'
import { commonOptions } from './utils'

/**
 * merge config to a single file
 *
 * .adv.json
 */
export function installConfigCommand(cli: Argv) {
  cli.command(
    'config',
    t('config.desc'),
    args =>
      commonOptions(args)
        .option('merge', {
          alias: 'm',
          default: true,
          describe: t('config.merge_desc'),
          type: 'boolean',
        })
        // target directory
        .option('target', {
          alias: 't',
          default: 'public',
          describe: t('config.target_desc'),
          type: 'string',
        })
        .option('base64', {
          alias: 'b',
          default: false,
          describe: t('config.base64_desc'),
          type: 'boolean',
        }),
    async ({ target, base64 }) => {
      consola.start(t('config.resolving'))
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
          if (!existsSync(srcPath)) {
            consola.warn(t('config.image_not_found', srcPath))
            return ''
          }
          const base64Data = readFileSync(srcPath).toString('base64')
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
      await ensureDir(targetDir)
      const gameConfigFile = path.resolve(targetDir, `${gameConfig.title}.adv.json`)
      await writeJSON(
        gameConfigFile,
        gameConfig,
        {
          spaces: 2,
        },
      )
      consola.success(t('config.merged', colors.dim(gameConfigFile)))
    },
  )
}
