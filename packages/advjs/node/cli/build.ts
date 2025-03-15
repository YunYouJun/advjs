import type { Argv } from 'yargs'
import path from 'node:path'
import { resolveOptions } from '../options'
import { commonOptions, printInfo } from './utils'

export async function installBuildCommand(cli: Argv) {
  cli.command(
    'build [entry]',
    'Build hostable SPA',
    args => commonOptions(args)
      .option('watch', {
        alias: 'w',
        default: false,
        describe: 'build watch',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        default: 'dist',
        describe: 'output dir',
      })
      .option('base', {
        type: 'string',
        describe: 'output base',
      })
      .strict()
      .help(),
    async ({ entry, theme, watch, base, output }) => {
      const { build } = await import('../commands/build')

      const options = await resolveOptions({ entry, theme }, 'build')

      printInfo(options)
      await build(options, {
        base,
        build: {
          watch: watch ? {} : undefined,
          outDir: path.resolve(options.userRoot, output),
        },
      })
    },
  )
}
