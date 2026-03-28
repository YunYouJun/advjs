import type { Argv } from 'yargs'
import process from 'node:process'
import { t } from './i18n'

function handleSyncError(err: unknown) {
  // Dynamic import to avoid circular deps at module level
  return import('../commands/sync').then(({ SyncError }) => {
    if (err instanceof SyncError)
      process.exit(1)
    throw err
  })
}

export function installSyncCommand(cli: Argv) {
  cli.command(
    'push',
    t('sync.push_desc'),
    yargs => yargs
      .option('root', {
        type: 'string',
        describe: t('sync.root_desc'),
      })
      .strict()
      .help(),
    async (argv) => {
      const { advPush } = await import('../commands/sync')
      try {
        await advPush({
          root: argv.root as string | undefined,
        })
      }
      catch (err) {
        await handleSyncError(err)
      }
    },
  )

  cli.command(
    'pull',
    t('sync.pull_desc'),
    yargs => yargs
      .option('root', {
        type: 'string',
        describe: t('sync.root_desc'),
      })
      .strict()
      .help(),
    async (argv) => {
      const { advPull } = await import('../commands/sync')
      try {
        await advPull({
          root: argv.root as string | undefined,
        })
      }
      catch (err) {
        await handleSyncError(err)
      }
    },
  )

  cli.command(
    'sync',
    t('sync.sync_desc'),
    yargs => yargs
      .option('root', {
        type: 'string',
        describe: t('sync.root_desc'),
      })
      .strict()
      .help(),
    async (argv) => {
      const { advSync } = await import('../commands/sync')
      try {
        await advSync({
          root: argv.root as string | undefined,
        })
      }
      catch (err) {
        await handleSyncError(err)
      }
    },
  )
}
