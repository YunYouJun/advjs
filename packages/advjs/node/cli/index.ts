import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { version } from '../../package.json'
import { installAgentCommand } from './agent'
import { installAssetsCommand } from './assets'
import { installBuildCommand } from './build'
import { installCheckCommand } from './check'
import { installConfigCommand } from './config'
import { installContextCommand } from './context'
import { ADV_CLI_COMMANDS } from './contracts'
import { installDebugCommand } from './debug'
import { installDeployCommand } from './deploy'
import { installDevCommand } from './dev'
import { installDoctorCommand } from './doctor'
import { installEditorCommand } from './editor'
import { installExportCommand } from './export'
import { setLocale } from './i18n'
import { installInitCommand } from './init'
import { configureCliOutput, createCliError, hasWrittenCliEnvelope, writeCliFailure } from './output'
import { installPlayCommand } from './play'
import { installSyncCommand } from './sync'

const namespace = 'adv'
const rawArguments = hideBin(process.argv)
const jsonOutput = rawArguments.includes('--json')
configureCliOutput(jsonOutput)

const cli = yargs(rawArguments)
  .scriptName(namespace)
  .usage('$0 [args]')
  .version(version)
  .strict()
  .exitProcess(false)
  .showHelpOnFail(false)
  .alias('h', 'help')
  .alias('v', 'version')
  .option('lang', {
    type: 'string',
    hidden: true,
  })
  .option('json', {
    type: 'boolean',
    hidden: true,
  })
  .middleware((argv) => {
    if (argv.lang)
      setLocale(argv.lang)
  }, true)

installEditorCommand(cli)
installAgentCommand(cli)
installAssetsCommand(cli)
installDoctorCommand(cli)
installDeployCommand(cli)
installDevCommand(cli)
installBuildCommand(cli)
installExportCommand(cli)
installConfigCommand(cli)
installInitCommand(cli)
installPlayCommand(cli)
installCheckCommand(cli)
installContextCommand(cli)
installDebugCommand(cli)
installSyncCommand(cli)

function inferContractCommand() {
  if (rawArguments.includes('agent') && rawArguments.includes('install'))
    return 'agent.install'
  if (rawArguments.includes('deploy') && rawArguments.includes('--artifact'))
    return 'deploy.artifact'
  return ADV_CLI_COMMANDS.find(command => rawArguments.includes(command)) ?? 'doctor'
}

async function main() {
  try {
    await cli
      .help()
      .parseAsync()
  }
  catch (error) {
    if (jsonOutput && !hasWrittenCliEnvelope())
      writeCliFailure(inferContractCommand(), createCliError('ADV_USAGE', error))
    else if (!jsonOutput)
      console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

await main()
