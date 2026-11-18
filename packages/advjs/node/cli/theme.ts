import type { Argv } from 'yargs'
import process from 'node:process'
import { gameUiThemePresets } from '@advjs/types'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { relative } from 'pathe'
import { AdvCommandError } from '../commands/errors'
import { t } from './i18n'
import { createCliError, runCliCommand } from './output'

function mapThemeError(error: unknown) {
  return error instanceof AdvCommandError
    ? createCliError(error.code, error)
    : createCliError('ADV_INTERNAL', error)
}

export function installThemeCommand(cli: Argv) {
  cli.command(
    'theme <action>',
    t('theme.desc'),
    args => args
      .positional('action', { choices: ['init', 'screenshot'] as const, demandOption: true, type: 'string' })
      .option('preset', { choices: gameUiThemePresets.map(preset => preset.id), describe: t('theme.preset_desc'), type: 'string' })
      .option('force', { default: false, describe: t('theme.force_desc'), type: 'boolean' })
      .option('url', { describe: t('theme.url_desc'), type: 'string' })
      .option('out', { describe: t('theme.out_desc'), type: 'string' })
      .option('viewport', { array: true, describe: t('theme.viewport_desc'), type: 'string' })
      .option('color-scheme', { choices: ['light', 'dark'] as const, describe: t('theme.color_scheme_desc'), type: 'string' })
      .option('locale', { describe: t('theme.locale_desc'), type: 'string' })
      .strict()
      .help(),
    async (argv) => {
      const cwd = process.cwd()
      const json = Boolean(argv.json)
      if (argv.action === 'init') {
        const result = await runCliCommand({
          command: 'theme.init',
          json,
          run: async () => {
            if (!argv.preset)
              throw new AdvCommandError('ADV_USAGE', `--preset is required: ${gameUiThemePresets.map(preset => preset.id).join(', ')}`)
            const { writeGameUiThemePreset } = await import('../game-ui/preset')
            const written = writeGameUiThemePreset(cwd, argv.preset, argv.force)
            return { ...written, file: relative(cwd, written.file) }
          },
          mapError: mapThemeError,
        })
        if (!json && result)
          consola.success(t('theme.init_done', result.file, result.preset))
        return
      }

      const result = await runCliCommand({
        command: 'theme.screenshot',
        json,
        run: async () => {
          const { captureGameUiScreenshots, parseGameUiViewport } = await import('../game-ui/screenshot')
          const captured = await captureGameUiScreenshots({
            cwd,
            url: argv.url,
            outDir: argv.out,
            viewports: argv.viewport?.map(value => parseGameUiViewport(String(value))),
            colorScheme: argv.colorScheme as 'light' | 'dark' | undefined,
            locale: argv.locale,
          })
          return {
            url: captured.url,
            outDir: relative(cwd, captured.outDir) || '.',
            report: relative(cwd, captured.report),
            shots: captured.shots.map(shot => ({ state: shot.state, viewport: shot.viewport, file: relative(cwd, shot.file) })),
            missing: captured.missing,
            consoleErrors: captured.consoleErrors,
          }
        },
        mapError: mapThemeError,
      })
      if (!json && result) {
        consola.success(t('theme.screenshot_done', result.shots.length, result.outDir))
        for (const shot of result.shots)
          consola.log(`  ${colors.dim(shot.viewport.padEnd(8))} ${shot.state.padEnd(13)} ${shot.file}`)
        for (const missing of result.missing)
          consola.warn(`${missing.viewport} ${missing.state}: ${missing.reason}`)
        for (const error of result.consoleErrors)
          consola.error(error)
      }
    },
  )
}
