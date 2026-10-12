import type { Argv } from 'yargs'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { FlowEditError, MAX_FLOW_PROPOSAL_BYTES, parseFlowProposalRequest, planFlowProposal, readFlowProposalSnapshot } from '@advjs/core'
import { createCliError, runCliCommand } from './output'

interface FlowCommandOptions {
  action: 'read' | 'plan'
  root: string
  path?: string
  request?: string
}

/** Existing project loader confines sources; request data is never a file path. */
export async function runFlowCommand(options: FlowCommandOptions) {
  let request: unknown
  if (options.action === 'plan') {
    if (!options.request)
      throw new FlowEditError('ADV_FLOW_PROPOSAL_INVALID', '--request must contain a JSON Flow proposal request')
    if (Buffer.byteLength(options.request, 'utf8') > MAX_FLOW_PROPOSAL_BYTES)
      throw new FlowEditError('ADV_FLOW_PROPOSAL_LIMIT', 'Flow proposal request exceeds 256 KiB')
    try {
      request = JSON.parse(options.request)
    }
    catch {
      throw new FlowEditError('ADV_FLOW_PROPOSAL_INVALID', '--request must contain valid JSON')
    }
    request = parseFlowProposalRequest(request)
  }
  else if (!options.path) {
    throw new FlowEditError('ADV_FLOW_INVALID_PATH', '--path is required for adv flow read')
  }

  const { loadProject } = await import('../project')
  const loaded = await loadProject({ root: options.root })
  const compileOptions = { plugins: Object.fromEntries(loaded.runtimePlugins.map(plugin => [plugin.name, plugin.version])) }
  return options.action === 'read'
    ? readFlowProposalSnapshot({ files: loaded.files, path: options.path!, options: compileOptions })
    : planFlowProposal({ files: loaded.files, request, options: compileOptions })
}

export function installFlowCommand(cli: Argv) {
  cli.command(
    'flow <action>',
    'Read a native Flow chapter or plan reviewable edits without writing files',
    args => args
      .positional('action', { choices: ['read', 'plan'] as const, demandOption: true, type: 'string' })
      .option('root', { default: '.', describe: 'ADV.JS project root', type: 'string' })
      .option('path', { describe: 'Existing project-relative .chapter.json path for read', type: 'string' })
      .option('request', { describe: 'Inline JSON proposal for plan, including expectedRevision and projectRevision from read (maximum 256 KiB)', type: 'string' })
      .strict()
      .help(),
    async (argv) => {
      const action = argv.action as 'read' | 'plan'
      const result = await runCliCommand({
        command: action === 'read' ? 'flow.read' : 'flow.plan',
        json: Boolean(argv.json),
        run: () => runFlowCommand({ action, root: argv.root, path: argv.path, request: argv.request }),
        mapError: error => error instanceof FlowEditError
          ? createCliError('ADV_VALIDATION', error, { code: error.code, references: error.references })
          : createCliError('ADV_INTERNAL', error),
      })
      // ok means planning completed; valid is the compiler's adoption gate.
      if (result && 'valid' in result && !result.valid)
        process.exitCode = 1
      if (!argv.json && result)
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    },
  )
}
