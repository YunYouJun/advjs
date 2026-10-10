import type { AdvVoiceDoctorResult, AdvVoicePreviewResult, AdvVoiceSetupResult } from '@advjs/types'
import type { Argv } from 'yargs'
import type { VoiceListResult } from '../commands/voice'
import process from 'node:process'
import { AdvCommandError } from '../commands/errors'
import { runVoiceDoctor, runVoicePreview, runVoiceProviders, runVoiceSetup } from '../commands/voice'
import { runVoiceSamples, runVoiceSelect } from '../commands/voice-library'
import { createCliError, runCliCommand } from './output'

/** Install provider-neutral authoring voice commands without loading a model. */
export function installVoiceCommand(cli: Argv): void {
  cli.command(
    'voice <action>',
    'Manage authoring voice providers, identities, and short samples',
    args => args
      .positional('action', {
        choices: ['doctor', 'setup', 'preview', 'providers', 'samples', 'select'] as const,
        demandOption: true,
        type: 'string',
      })
      .option('root', {
        default: '.',
        describe: 'ADV.JS project root',
        type: 'string',
      })
      .option('provider', { describe: 'Installed voice provider id', type: 'string' })
      .option('voice', { describe: 'Stable project voice identity', type: 'string' })
      .option('asset', { describe: 'Registered sample asset id to select', type: 'string' })
      .option('expected-revision', { describe: 'Voice library revision returned by samples', type: 'string' })
      .option('replace-selected', { describe: 'Explicitly replace an existing sample selection', type: 'boolean', default: false })
      .option('preset', {
        describe: 'Project-owned voice preset id',
        type: 'string',
      })
      .option('reference-mode', {
        describe: 'Reference conditioning mode; otherwise use the project default',
        type: 'string',
      })
      .option('character', {
        describe: 'Generate only this character id',
        type: 'string',
      })
      .option('text', {
        describe: 'Override one character target line',
        type: 'string',
      })
      .option('seed', {
        type: 'number',
      })
      .option('offline', {
        default: false,
        describe: 'Require locally cached model files',
        type: 'boolean',
      })
      .option('list', {
        default: false,
        describe: 'List selected preset inputs without invoking the provider',
        type: 'boolean',
      })
      .strict()
      .help(),
    async (argv) => {
      const action = argv.action as 'doctor' | 'setup' | 'preview' | 'providers' | 'samples' | 'select'
      const controller = new AbortController()
      const interrupt = () => controller.abort(new Error('Voice command interrupted'))
      process.once('SIGINT', interrupt)
      process.once('SIGTERM', interrupt)
      try {
        const result = await runCliCommand<AdvVoiceDoctorResult | AdvVoiceSetupResult | VoiceListResult | AdvVoicePreviewResult | Awaited<ReturnType<typeof runVoiceProviders>> | Awaited<ReturnType<typeof runVoiceSamples>>>({
          command: `voice.${action}`,
          json: Boolean(argv.json),
          run: async () => {
            if (action !== 'preview' && (argv.list || argv.preset || argv.referenceMode || argv.character || argv.text || argv.offline || argv.seed !== undefined))
              throw new AdvCommandError('ADV_USAGE', 'Voice generation options require adv voice preview')
            const options = {
              root: String(argv.root),
              provider: argv.provider,
              signal: controller.signal,
              onProgress: (message: string) => process.stderr.write(`${message.trimEnd()}\n`),
            }
            if (action !== 'select' && (argv.asset || argv.expectedRevision || argv.replaceSelected))
              throw new AdvCommandError('ADV_USAGE', 'Sample selection options require adv voice select')
            if (action !== 'preview' && action !== 'select' && argv.voice)
              throw new AdvCommandError('ADV_USAGE', '--voice requires preview or select')
            if (action === 'providers')
              return await runVoiceProviders(options)
            if (action === 'samples')
              return await runVoiceSamples(options)
            if (action === 'select') {
              if (!argv.voice || !argv.asset || !argv.expectedRevision)
                throw new AdvCommandError('ADV_USAGE', 'select requires --voice, --asset, and --expected-revision')
              return await runVoiceSelect({ ...options, voiceId: argv.voice, assetId: argv.asset, expectedRevision: argv.expectedRevision, replaceSelected: Boolean(argv.replaceSelected) })
            }
            if (action === 'doctor')
              return await runVoiceDoctor(options)
            if (action === 'setup')
              return await runVoiceSetup(options)
            return await runVoicePreview({
              ...options,
              voice: argv.voice,
              preset: argv.preset,
              referenceMode: argv.referenceMode,
              character: argv.character,
              text: argv.text,
              seed: argv.seed === undefined ? undefined : Number(argv.seed),
              offline: Boolean(argv.offline),
              list: Boolean(argv.list),
            })
          },
          mapError: error => createCliError(error instanceof AdvCommandError ? error.code : 'ADV_INTERNAL', error),
        })
        if (!argv.json && result) {
          if ('checks' in result) {
            for (const check of result.checks)
              process.stdout.write(`${check.status.toUpperCase()} ${check.id}: ${check.message}\n`)
          }
          else if ('characters' in result) {
            for (const character of result.characters)
              process.stdout.write(`${character.id} (${character.name}): ${character.text}\n`)
          }
          else if ('manifestPath' in result) {
            process.stdout.write(`Voice candidate manifest: ${result.manifestPath}\n`)
          }
          else if ('providers' in result) {
            for (const provider of result.providers)
              process.stdout.write(`${provider.id}${provider.default ? ' (default)' : ''}\n`)
          }
          else if ('voices' in result) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
          }
          else {
            process.stdout.write(`Voice provider ready: ${result.provider}\n`)
          }
        }
        if (result && 'ready' in result && !result.ready)
          process.exitCode = 1
      }
      finally {
        process.removeListener('SIGINT', interrupt)
        process.removeListener('SIGTERM', interrupt)
      }
    },
  )
}
