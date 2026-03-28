import type { Argv } from 'yargs'
import process from 'node:process'
import { t } from './i18n'

export function installCheckCommand(cli: Argv) {
  cli.command(
    'check',
    t('check.desc'),
    yargs => yargs
      .option('root', {
        type: 'string',
        describe: t('check.root_desc'),
      })
      .strict()
      .help(),
    async (argv) => {
      const { CheckError, advCheck } = await import('../commands/check')
      try {
        await advCheck({
          root: argv.root as string | undefined,
        })
      }
      catch (err) {
        if (err instanceof CheckError)
          process.exit(1)
        throw err
      }
    },
  )
}
