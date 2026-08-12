import type { AdvCliCommand, AdvCliEnvelope, AdvCliError, AdvCliMessage, AdvErrorCode } from './contracts'
import { Console } from 'node:console'
import process from 'node:process'
import { ADV_CLI_SCHEMA_VERSION } from './contracts'

const writeOriginalStdout = process.stdout.write.bind(process.stdout)
let jsonOutputEnabled = false
let envelopeWritten = false

export interface RunCliCommandOptions<TData> {
  command: AdvCliCommand
  json: boolean
  run: () => Promise<TData>
  mapError?: (error: unknown) => AdvCliError
  warnings?: AdvCliMessage[]
}

export function configureCliOutput(json: boolean) {
  jsonOutputEnabled = json
  if (json)
    process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write
}

export function hasWrittenCliEnvelope() {
  return envelopeWritten
}

export async function createStderrViteLogger() {
  const { createLogger } = await import('vite')
  return createLogger('info', {
    allowClearScreen: false,
    console: new Console({
      colorMode: false,
      stderr: process.stderr,
      stdout: process.stderr,
    }),
  })
}

export function createCliError(code: AdvErrorCode, error: unknown, details?: Record<string, unknown>): AdvCliError {
  return {
    code,
    message: error instanceof Error ? error.message : String(error),
    ...(details ? { details } : {}),
  }
}

export function writeCliEnvelope<TCommand extends AdvCliCommand, TData>(envelope: AdvCliEnvelope<TCommand, TData>) {
  if (!jsonOutputEnabled)
    throw new Error('CLI JSON output is not enabled')
  if (envelopeWritten)
    throw new Error('The CLI can write only one JSON envelope')

  envelopeWritten = true
  writeOriginalStdout(`${JSON.stringify(envelope)}\n`)
}

export function writeCliEditorEvent(data: { event: 'ready', root: string, url: string } | { event: 'stopped' }) {
  envelopeWritten = true
  writeOriginalStdout(`${JSON.stringify({
    schemaVersion: ADV_CLI_SCHEMA_VERSION,
    command: 'editor',
    ok: true,
    data,
    warnings: [],
    errors: [],
  } satisfies AdvCliEnvelope<'editor', typeof data>)}\n`)
}

export function writeCliFailure(command: AdvCliCommand, error: AdvCliError) {
  writeCliEnvelope({
    schemaVersion: ADV_CLI_SCHEMA_VERSION,
    command,
    ok: false,
    data: null,
    warnings: [],
    errors: [error],
  })
}

export async function runCliCommand<TData>(options: RunCliCommandOptions<TData>): Promise<TData | undefined> {
  if (!options.json)
    return await options.run()

  try {
    const data = await options.run()
    writeCliEnvelope({
      schemaVersion: ADV_CLI_SCHEMA_VERSION,
      command: options.command,
      ok: true,
      data,
      warnings: options.warnings ?? [],
      errors: [],
    })
    return data
  }
  catch (error) {
    writeCliFailure(options.command, options.mapError?.(error) ?? createCliError('ADV_INTERNAL', error))
    process.exitCode = 1
  }
}
