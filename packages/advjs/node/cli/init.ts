import type { Argv } from 'yargs'
import { t } from './i18n'
import { createCliError, runCliCommand } from './output'

export function installInitCommand(cli: Argv) {
  cli.command(
    'init [dir]',
    t('init.desc'),
    yargs => yargs
      .positional('dir', {
        type: 'string',
        describe: t('init.dir_desc'),
      })
      .option('name', {
        type: 'string',
        describe: t('init.name_desc'),
      })
      .option('force', {
        type: 'boolean',
        default: false,
        describe: t('init.force_desc'),
      })
      .option('template', {
        type: 'string',
        choices: ['default', 'galgame'] as const,
        default: 'default' as const,
        describe: t('init.template_desc'),
      })
      .strict()
      .help(),
    async (argv) => {
      const { InitError, advInit } = await import('../commands/init')
      await runCliCommand({
        command: 'init',
        json: Boolean(argv.json),
        run: async () => await advInit({
          root: argv.dir as string | undefined,
          name: argv.name as string | undefined,
          force: argv.force as boolean,
          template: argv.template as string | undefined,
        }),
        mapError: error => error instanceof InitError
          ? createCliError('ADV_VALIDATION', error)
          : createCliError('ADV_INTERNAL', error),
      })
    },
  )
}
