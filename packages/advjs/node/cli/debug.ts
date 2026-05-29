import type { Argv } from 'yargs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { consola } from 'consola'
import { t } from './i18n'

export function installDebugCommand(cli: Argv) {
  cli.command(
    'debug',
    t('debug.desc'),
    yargs => yargs
      .command(
        'branches <script>',
        t('debug.branches_desc'),
        y => y
          .positional('script', {
            type: 'string',
            demandOption: true,
            describe: t('debug.branches_script_desc'),
          })
          .option('format', {
            type: 'string',
            choices: ['mermaid', 'json', 'text'] as const,
            default: 'mermaid' as const,
            describe: t('debug.branches_format_desc'),
          })
          .option('output', {
            alias: 'o',
            type: 'string',
            describe: t('debug.branches_output_desc'),
          })
          .strict()
          .help(),
        async (argv) => {
          const { analyzeBranchesFromFile } = await import('../commands/branches')
          const scriptPath = resolve(process.cwd(), argv.script as string)
          const out = await analyzeBranchesFromFile({
            scriptPath,
            format: argv.format as 'mermaid' | 'json' | 'text',
          })
          const outputPath = argv.output as string | undefined
          if (outputPath) {
            await writeFile(resolve(process.cwd(), outputPath), out, 'utf-8')
            consola.success(t('debug.branches_written', outputPath))
          }
          else {
            console.log(out)
          }
        },
      )
      .command(
        'coverage <script>',
        t('debug.coverage_desc'),
        y => y
          .positional('script', {
            type: 'string',
            demandOption: true,
            describe: t('debug.coverage_script_desc'),
          })
          .option('format', {
            type: 'string',
            choices: ['text', 'json'] as const,
            default: 'text' as const,
            describe: t('debug.coverage_format_desc'),
          })
          .option('output', {
            alias: 'o',
            type: 'string',
            describe: t('debug.coverage_output_desc'),
          })
          .strict()
          .help(),
        async (argv) => {
          const { analyzeCoverageFromFile } = await import('../commands/branches')
          const scriptPath = resolve(process.cwd(), argv.script as string)
          const out = await analyzeCoverageFromFile({
            scriptPath,
            format: argv.format as 'text' | 'json',
          })
          const outputPath = argv.output as string | undefined
          if (outputPath) {
            await writeFile(resolve(process.cwd(), outputPath), out, 'utf-8')
            consola.success(t('debug.coverage_written', outputPath))
          }
          else {
            console.log(out)
          }
        },
      )
      .demandCommand(1, t('debug.subcommand_required'))
      .strict()
      .help(),
    () => {},
  )
}
