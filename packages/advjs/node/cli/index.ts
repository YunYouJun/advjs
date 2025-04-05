import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { version } from '../../package.json'

import { installBuildCommand } from './build'
import { installConfigCommand } from './config'
import { installDevCommand } from './dev'
import { installExportCommand } from './export'

const namespace = 'adv'
const cli = yargs(hideBin(process.argv))
  .scriptName(namespace)
  .usage('$0 [args]')
  .version(version)
  .strict()
  .showHelpOnFail(false)
  .alias('h', 'help')
  .alias('v', 'version')

installDevCommand(cli)
installBuildCommand(cli)
installExportCommand(cli)
installConfigCommand(cli)

cli
  .help()
  .parse()
