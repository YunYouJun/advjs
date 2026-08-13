import type { Argv } from 'yargs'
import process from 'node:process'
import { resolve } from 'pathe'
import { AdvCommandError } from '../commands/errors'
import { createCliError, runCliCommand } from './output'

export function installAssetsCommand(cli: Argv) {
  cli.command(
    'assets <action>',
    'Plan, ingest, review, and register generated project assets',
    args => args
      .positional('action', {
        choices: ['plan', 'ingest', 'reject', 'accept'] as const,
        demandOption: true,
        type: 'string',
      })
      .option('root', {
        default: '.',
        describe: 'ADV.JS project root',
        type: 'string',
      })
      .option('scene', {
        describe: 'Scene id whose imagePrompt should become a generation task',
        type: 'string',
      })
      .option('task', {
        describe: 'Asset generation task id',
        type: 'string',
      })
      .option('candidate', {
        describe: 'Project-relative candidate file under the task candidate directory',
        type: 'string',
      })
      .option('candidate-id', {
        describe: 'Candidate id used by reject or accept',
        type: 'string',
      })
      .option('executor', {
        default: 'codex-imagegen',
        describe: 'Provider-neutral executor id recorded in provenance',
        type: 'string',
      })
      .option('model', {
        describe: 'Optional model name recorded in provenance',
        type: 'string',
      })
      .option('reason', {
        describe: 'Human review reason required when rejecting a candidate',
        type: 'string',
      })
      .option('width', {
        default: 1536,
        type: 'number',
      })
      .option('height', {
        default: 864,
        type: 'number',
      })
      .option('confirm', {
        default: false,
        describe: 'Confirm that the selected candidate was visually reviewed and accepted',
        type: 'boolean',
      })
      .option('replace-existing', {
        default: false,
        describe: 'Separately approve replacing an existing stable asset id',
        type: 'boolean',
      })
      .strict()
      .help(),
    async (argv) => {
      const action = String(argv.action) as 'plan' | 'ingest' | 'reject' | 'accept'
      const root = String(argv.root)
      const projectRoot = resolve(root)
      const commands = await import('../commands/assets')
      const required = (value: unknown, flag: string) => {
        if (typeof value !== 'string' || !value.trim())
          throw new AdvCommandError('ADV_USAGE', `${flag} is required for adv assets ${action}`)
        return value
      }
      const result = await runCliCommand({
        command: 'assets',
        json: Boolean(argv.json),
        run: async () => {
          if (action === 'plan') {
            const planned = await commands.planBackgroundAssetGeneration({
              root,
              sceneId: required(argv.scene, '--scene'),
              width: Number(argv.width),
              height: Number(argv.height),
            })
            return {
              action,
              root: projectRoot,
              taskId: planned.task.id,
              status: planned.task.status,
              candidateDirectory: planned.candidateDirectory,
            }
          }
          if (action === 'ingest') {
            const ingested = await commands.ingestAssetGenerationCandidate({
              root,
              taskId: required(argv.task, '--task'),
              candidatePath: required(argv.candidate, '--candidate'),
              executor: {
                id: String(argv.executor),
                model: argv.model ? String(argv.model) : undefined,
              },
            })
            return {
              action,
              root: projectRoot,
              taskId: ingested.task.id,
              status: ingested.task.status,
              candidateId: ingested.candidate!.id,
            }
          }
          if (action === 'reject') {
            const rejected = await commands.rejectAssetGenerationCandidate({
              root,
              taskId: required(argv.task, '--task'),
              candidateId: required(argv.candidateId, '--candidate-id'),
              reason: required(argv.reason, '--reason'),
            })
            return {
              action,
              root: projectRoot,
              taskId: rejected.task.id,
              status: rejected.task.status,
              candidateId: String(argv.candidateId),
            }
          }
          if (!argv.confirm) {
            throw new AdvCommandError(
              'ADV_USAGE',
              'adv assets accept requires --confirm after visual review; generation success is not approval',
            )
          }
          const accepted = await commands.acceptAssetGenerationCandidate({
            root,
            taskId: required(argv.task, '--task'),
            candidateId: required(argv.candidateId, '--candidate-id'),
            replaceExisting: Boolean(argv.replaceExisting),
          })
          return {
            action,
            root: projectRoot,
            taskId: accepted.task.id,
            status: accepted.task.status,
            candidateId: String(argv.candidateId),
            assetId: accepted.asset.id,
            writes: accepted.writes,
          }
        },
        mapError: error => createCliError(
          error instanceof AdvCommandError ? error.code : 'ADV_INTERNAL',
          error,
        ),
      })
      if (!argv.json && result)
        process.stdout.write(`${result.action}: ${result.taskId} (${result.status})\n`)
    },
  )
}
