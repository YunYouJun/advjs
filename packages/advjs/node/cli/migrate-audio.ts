import type { Argv } from 'yargs'
import type { AudioMigrationReport } from '../commands/migrate-audio'
import process from 'node:process'
import { AdvCommandError } from '../commands/errors'
import { applyAudioMigration, planAudioMigration, readAudioMigrationInput, recoverAudioMigration, writeAudioMigrationReport } from '../commands/migrate-audio'
import { createCliError, runCliCommand } from './output'

export function installMigrateAudioCommand(cli: Argv): void {
  cli.command('migrate-audio', 'Review and apply explicit legacy audio-to-native-asset mappings', args => args
    .option('root', { type: 'string', default: '.', describe: 'ADV.JS project root' })
    .option('catalog', { type: 'string', default: 'adv/assets.json', describe: 'Native catalog path inside the project' })
    .option('map', { type: 'string', describe: 'Project-local JSON object of exact old references to native asset IDs' })
    .option('report', { type: 'string', describe: 'Save the dry-run review report inside the project' })
    .option('apply', { type: 'string', describe: 'Apply this reviewed project-local report after source revalidation' })
    .option('recover', { type: 'string', describe: 'Recover an interrupted journal by its report SHA-256 revision' })
    .strict()
    .help(), async (argv) => {
    const result = await runCliCommand({
      command: 'migrate.audio',
      json: Boolean(argv.json),
      run: async () => {
        const root = String(argv.root)
        if ((argv.apply && argv.recover) || ((argv.apply || argv.recover) && (argv.map || argv.report)))
          throw new AdvCommandError('ADV_USAGE', '--apply and --recover are separate actions; --map and --report belong to dry-run planning')
        if (argv.recover)
          return await recoverAudioMigration({ root, revision: argv.recover })
        if (argv.apply)
          return await applyAudioMigration({ root, report: await readAudioMigrationInput(root, argv.apply) as AudioMigrationReport })
        const mapping = argv.map ? await readAudioMigrationInput(root, argv.map) as Record<string, string> : {}
        const report = await planAudioMigration({ root, catalogPath: argv.catalog, mapping })
        if (argv.report)
          await writeAudioMigrationReport(root, argv.report, report)
        return report
      },
      mapError: error => createCliError(error instanceof AdvCommandError ? error.code : 'ADV_INTERNAL', error),
    })
    if (result && 'unresolved' in result && result.unresolved.length)
      process.exitCode = 1
    if (result && !argv.json)
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  })
}
