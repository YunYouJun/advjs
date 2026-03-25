import type { Argv } from 'yargs'
import { t } from './i18n'
import { commonOptions } from './utils'

export async function installBuildCommand(cli: Argv) {
  cli.command(
    'build [entry]',
    t('build.desc'),
    args => commonOptions(args)
      .option('singlefile', {
        type: 'boolean',
        default: false,
        describe: t('build.singlefile_desc'),
      })
      .option('outDir', {
        type: 'string',
        default: 'dist',
        describe: t('build.outdir_desc'),
      })
      .option('base', {
        type: 'string',
        describe: t('build.base_desc'),
      })
      .strict()
      .help(),
    async ({ theme, base, outDir, singlefile }) => {
      const { advBuild } = await import('../commands/build')
      await advBuild({
        base,
        outDir,
        theme,
        singlefile,
      })
    },
  )
}
