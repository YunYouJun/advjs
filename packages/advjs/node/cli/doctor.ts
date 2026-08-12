import type { Argv } from 'yargs'
import process from 'node:process'
import { ADV_AGENT_CLIENTS } from '../agent'
import { runDoctor } from '../commands/doctor'
import { createCliError, runCliCommand } from './output'

export function installDoctorCommand(cli: Argv) {
  cli.command(
    'doctor [root]',
    'Diagnose the ADV.JS authoring and deployment environment',
    args => args
      .positional('root', {
        default: '.',
        type: 'string',
      })
      .option('client', {
        choices: ADV_AGENT_CLIENTS,
        default: 'codex' as const,
        type: 'string',
      })
      .option('port', {
        default: 0,
        type: 'number',
      })
      .option('home', {
        hidden: true,
        type: 'string',
      })
      .strict()
      .help(),
    async (argv) => {
      const result = await runCliCommand({
        command: 'doctor',
        json: Boolean(argv.json),
        run: async () => await runDoctor({
          client: argv.client as typeof ADV_AGENT_CLIENTS[number],
          home: argv.home as string | undefined,
          port: Number(argv.port),
          projectRoot: String(argv.root),
        }),
        mapError: error => createCliError('ADV_INTERNAL', error),
      })
      if (!argv.json && result) {
        for (const item of result.checks)
          process.stdout.write(`${item.status.toUpperCase()} ${item.id}: ${item.message}\n`)
        if (result.checks.some(item => item.status === 'fail'))
          process.exitCode = 1
      }
    },
  )
}
