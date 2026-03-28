import type { Argv } from 'yargs'
import process from 'node:process'
import { t } from './i18n'

export function installContextCommand(cli: Argv) {
  cli.command(
    'context',
    t('context.desc'),
    yargs => yargs
      .option('root', {
        type: 'string',
        describe: t('context.root_desc'),
      })
      .option('full', {
        type: 'boolean',
        default: false,
        describe: t('context.full_desc'),
      })
      .option('chapter', {
        type: 'number',
        describe: t('context.chapter_desc'),
      })
      .strict()
      .help(),
    async (argv) => {
      const { ContextError, advContext } = await import('../commands/context')
      try {
        await advContext({
          root: argv.root as string | undefined,
          full: argv.full,
          chapter: argv.chapter as number | undefined,
        })
      }
      catch (err) {
        if (err instanceof ContextError)
          process.exit(1)
        throw err
      }
    },
  )
}
