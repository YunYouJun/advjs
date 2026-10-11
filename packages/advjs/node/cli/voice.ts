import type { AdvVoiceDoctorResult, AdvVoicePreviewResult, AdvVoiceSetupResult } from '@advjs/types'
import type { Argv } from 'yargs'
import type { VoiceListResult } from '../commands/voice'
import process from 'node:process'
import { runVoiceBindTake, runVoiceGenerateTake, runVoiceLedger } from '../audio/voice'
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
        choices: ['doctor', 'setup', 'preview', 'providers', 'samples', 'select', 'takes', 'generate', 'bind'] as const,
        demandOption: true,
        type: 'string',
      })
      .option('root', {
        default: '.',
        describe: 'ADV.JS project root',
        type: 'string',
      })
      .option('provider', { describe: 'Installed voice provider id', type: 'string' })
      .option('line', { describe: 'Stable dialogue line ID', type: 'string' })
      .option('locale', { describe: 'Exact BCP 47 locale', type: 'string' })
      .option('speaker', { describe: 'Character ID or narrator for a new ledger line', type: 'string' })
      .option('take', { describe: 'Immutable take ID to bind', type: 'string' })
      .option('profile-revision', { describe: 'Reviewed voice profile SHA-256 revision', type: 'string' })
      .option('spoken-text', { describe: 'Explicit deterministic spoken text for a generated take', type: 'string' })
      .option('voice-source', { describe: 'Auditable synthesis source', choices: ['system', 'designed', 'cloned'] as const })
      .option('license', { describe: 'Voice rights license', type: 'string' })
      .option('subject', { describe: 'Voice rights subject', type: 'string' })
      .option('consent-record', { describe: 'Project-local voice consent document', type: 'string' })
      .option('voice', { describe: 'Stable project voice identity', type: 'string' })
      .option('asset', { describe: 'Registered sample asset id to select', type: 'string' })
      .option('expected-revision', { describe: 'Voice library/audio revision returned by samples or takes', type: 'string' })
      .option('replace-selected', { describe: 'Explicitly replace an existing sample or take selection', type: 'boolean', default: false })
      .option('preset', {
        describe: 'Project-owned voice preset id',
        type: 'string',
      })
      .option('reference-mode', {
        describe: 'Reference conditioning mode; otherwise use the project default',
        type: 'string',
      })
      .option('character', {
        describe: 'Generate only this character ID',
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
      const action = argv.action as 'doctor' | 'setup' | 'preview' | 'providers' | 'samples' | 'select' | 'takes' | 'generate' | 'bind'
      const controller = new AbortController()
      const interrupt = () => controller.abort(new Error('Voice command interrupted'))
      process.once('SIGINT', interrupt)
      process.once('SIGTERM', interrupt)
      try {
        const result = await runCliCommand<AdvVoiceDoctorResult | AdvVoiceSetupResult | VoiceListResult | AdvVoicePreviewResult | Awaited<ReturnType<typeof runVoiceLedger>> | Awaited<ReturnType<typeof runVoiceProviders>> | Awaited<ReturnType<typeof runVoiceSamples>>>({
          command: `voice.${action}`,
          json: Boolean(argv.json),
          run: async () => {
            const audioOptions = { root: String(argv.root), signal: controller.signal }
            if (action === 'takes')
              return await runVoiceLedger(audioOptions)
            if (action === 'bind') {
              if (!argv.line || !argv.locale || !argv.take || !argv.expectedRevision)
                throw new AdvCommandError('ADV_USAGE', 'bind requires --line, --locale, --take and --expected-revision')
              return await runVoiceBindTake({ ...audioOptions, lineId: argv.line, locale: argv.locale, takeId: argv.take, expectedRevision: argv.expectedRevision, replaceSelected: Boolean(argv.replaceSelected) })
            }
            if (action === 'generate') {
              if (argv.list)
                throw new AdvCommandError('ADV_USAGE', '--list requires voice preview; generation must be explicit')
              if (!argv.line || !argv.locale || !argv.expectedRevision)
                throw new AdvCommandError('ADV_USAGE', 'generate requires --line, --locale and --expected-revision')
              const hasRights = Boolean(argv.license || argv.subject || argv.consentRecord)
              if (hasRights && (!argv.license || !argv.subject || !argv.consentRecord))
                throw new AdvCommandError('ADV_USAGE', 'Voice rights require --license, --subject and --consent-record together')
              return await runVoiceGenerateTake({ ...audioOptions, lineId: argv.line, locale: argv.locale, expectedRevision: argv.expectedRevision, provider: argv.provider, preset: argv.preset, voice: argv.voice, character: argv.character ?? argv.speaker, speakerId: argv.speaker, displayText: argv.text, spokenText: argv.spokenText, text: argv.text, voiceProfileRevision: argv.profileRevision, referenceMode: argv.referenceMode, offline: Boolean(argv.offline), seed: argv.seed, source: argv.voiceSource, ...(hasRights ? { rights: { license: argv.license!, subject: argv.subject!, consentRecord: argv.consentRecord! } } : {}) })
            }
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
          else if ('ledger' in result) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
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
