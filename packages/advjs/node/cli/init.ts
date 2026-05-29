import type { Argv } from 'yargs'
import process from 'node:process'
import { t } from './i18n'

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
      try {
        await advInit({
          root: argv.dir as string | undefined,
          name: argv.name as string | undefined,
          force: argv.force as boolean,
          template: argv.template as string | undefined,
        })
      }
      catch (err) {
        if (err instanceof InitError)
          process.exit(1)
        throw err
      }
    },
  )
}
