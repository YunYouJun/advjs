import process from 'node:process'
import { hideBin } from 'yargs/helpers'
import yargs from 'yargs'
import { version } from '../../package.json'

import { installDevCommand } from './dev'
import { installBuildCommand } from './build'
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

cli
  .help()
  .parse()
