import type { Argv } from 'yargs'
import path from 'node:path'
import { resolveOptions } from '../options'
import { commonOptions, printInfo } from './utils'

export async function installBuildCommand(cli: Argv) {
  cli.command(
    'build [entry]',
    'Build hostable SPA',
    args => commonOptions(args)
      .option('local', {
        type: 'boolean',
        default: true,
        describe: '使用相对路径构建, 支持 index.html 直接打开',
      })
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
    async ({ entry, theme, watch, base, output, local }) => {
      const { build } = await import('../commands/build')

      const options = await resolveOptions({ entry, theme }, 'build')

      printInfo(options)
      await build(options, {
        base: local ? './' : base,
        build: {
          watch: watch ? {} : undefined,
          outDir: path.resolve(options.userRoot, output),
        },
      })
    },
  )
}
