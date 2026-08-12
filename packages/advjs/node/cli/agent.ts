import type { Argv } from 'yargs'
import process from 'node:process'
import { ADV_AGENT_CLIENTS, AgentInstallError, installAgentIntegration } from '../agent'
import { createCliError, runCliCommand } from './output'

export function installAgentCommand(cli: Argv) {
  cli.command(
    'agent install',
    'Install ADV.JS Skills and MCP configuration for an Agent client',
    args => args
      .option('client', {
        choices: ADV_AGENT_CLIENTS,
        demandOption: true,
        type: 'string',
      })
      .option('skills', {
        default: 'default',
        type: 'string',
      })
      .option('mcp', {
        default: false,
        type: 'boolean',
      })
      .option('dry-run', {
        default: false,
        type: 'boolean',
      })
      .option('home', {
        hidden: true,
        type: 'string',
      })
      .strict()
      .help(),
    async (argv) => {
      const result = await runCliCommand({
        command: 'agent.install',
        json: Boolean(argv.json),
        run: async () => await installAgentIntegration({
          client: argv.client as typeof ADV_AGENT_CLIENTS[number],
          dryRun: Boolean(argv.dryRun),
          home: argv.home as string | undefined,
          mcp: Boolean(argv.mcp),
          skills: String(argv.skills),
        }),
        mapError: error => createCliError(error instanceof AgentInstallError ? 'ADV_USAGE' : 'ADV_INTERNAL', error),
      })
      if (!argv.json && result) {
        const action = result.dryRun ? 'Would configure' : result.changed ? 'Configured' : 'Already configured'
        process.stdout.write(`${action} ${result.client}: ${result.skills.map(skill => skill.name).join(', ')}\n`)
      }
    },
  )
}
