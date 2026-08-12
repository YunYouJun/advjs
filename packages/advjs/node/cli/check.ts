import type { Argv } from 'yargs'
import process from 'node:process'
import { t } from './i18n'
import { createCliError, runCliCommand } from './output'

export function installCheckCommand(cli: Argv) {
  cli.command(
    'check',
    t('check.desc'),
    yargs => yargs
      .option('root', {
        type: 'string',
        describe: t('check.root_desc'),
      })
      .option('fix', {
        type: 'boolean',
        default: false,
        describe: t('check.fix_desc'),
      })
      .strict()
      .help(),
    async (argv) => {
      const { CheckError, advCheck } = await import('../commands/check')
      await runCliCommand({
        command: 'check',
        json: Boolean(argv.json),
        run: async () => {
          const result = await advCheck({
            root: argv.root as string | undefined,
            fix: argv.fix as boolean,
          })
          return {
            root: process.cwd(),
            diagnostics: result.issues.map(issue => ({
              severity: issue.type,
              code: issue.code ?? `ADV_${issue.category.replaceAll('-', '_').toUpperCase()}`,
              message: issue.message,
              path: issue.file,
            })),
          }
        },
        mapError: error => error instanceof CheckError
          ? createCliError('ADV_VALIDATION', error, {
              issueCount: error.issueCount,
              diagnostics: error.result?.issues ?? [],
            })
          : createCliError('ADV_INTERNAL', error),
      })
    },
  )
}
