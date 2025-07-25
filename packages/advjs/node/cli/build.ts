import type { Argv } from 'yargs'
import { commonOptions } from './utils'

export async function installBuildCommand(cli: Argv) {
  cli.command(
    'build [entry]',
    'Build hostable SPA',
    args => commonOptions(args)
      .option('singlefile', {
        type: 'boolean',
        default: false,
        describe: '构建为单个文件, 支持 index.html 直接打开',
      })
      .option('outDir', {
        type: 'string',
        default: 'dist',
        describe: 'Output directory',
      })
      .option('base', {
        type: 'string',
        describe: 'output base',
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
