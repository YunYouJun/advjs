import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { version } from '../../package.json'
import { installBuildCommand } from './build'
import { installCheckCommand } from './check'
import { installConfigCommand } from './config'
import { installContextCommand } from './context'
import { installDevCommand } from './dev'
import { installExportCommand } from './export'
import { setLocale } from './i18n'
import { installPlayCommand } from './play'
import { installSyncCommand } from './sync'

const namespace = 'adv'
const cli = yargs(hideBin(process.argv))
  .scriptName(namespace)
  .usage('$0 [args]')
  .version(version)
  .strict()
  .showHelpOnFail(false)
  .alias('h', 'help')
  .alias('v', 'version')
  .option('lang', {
    type: 'string',
    hidden: true,
  })
  .middleware((argv) => {
    if (argv.lang)
      setLocale(argv.lang)
  }, true)

installDevCommand(cli)
installBuildCommand(cli)
installExportCommand(cli)
installConfigCommand(cli)
installPlayCommand(cli)
installCheckCommand(cli)
installContextCommand(cli)
installSyncCommand(cli)

cli
  .help()
  .parse()
