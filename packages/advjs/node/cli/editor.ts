import type { Argv } from 'yargs'
import process from 'node:process'
import openBrowser from 'open'
import { createEditorBridge, EditorBridgeError } from '../editor'
import { createCliError, writeCliEditorEvent, writeCliFailure } from './output'

export function installEditorCommand(cli: Argv) {
  cli.command(
    'editor [root]',
    'Open the local ADV.JS Editor for a project',
    args => args
      .positional('root', {
        default: '.',
        type: 'string',
      })
      .option('host', {
        default: '127.0.0.1',
        type: 'string',
      })
      .option('port', {
        default: 3000,
        type: 'number',
      })
      .option('open', {
        default: true,
        type: 'boolean',
      })
      .strict()
      .help(),
    async (argv) => {
      const json = Boolean(argv.json)
      let bridge: Awaited<ReturnType<typeof createEditorBridge>> | undefined
      const signals = ['SIGINT', 'SIGTERM'] as const
      let resolveSignal: ((signal: NodeJS.Signals) => void) | undefined
      const onSignal = (signal: NodeJS.Signals) => resolveSignal?.(signal)

      try {
        bridge = await createEditorBridge({
          host: String(argv.host),
          port: Number(argv.port),
          projectRoot: String(argv.root),
        })
        const ready = await bridge.start()
        if (json)
          writeCliEditorEvent(ready)
        else
          process.stdout.write(`ADV.JS Editor ready at ${ready.url}\n`)

        if (argv.open) {
          await openBrowser(ready.url).catch((error) => {
            process.stderr.write(`Unable to open a browser automatically: ${error instanceof Error ? error.message : String(error)}\n`)
          })
        }

        const signal = await new Promise<NodeJS.Signals>((resolve) => {
          resolveSignal = resolve
          for (const name of signals)
            process.once(name, onSignal)
        })
        await bridge.stop()
        const stopped = { event: 'stopped' as const }
        if (json)
          writeCliEditorEvent(stopped)
        else
          process.stdout.write(`ADV.JS Editor stopped (${signal})\n`)
      }
      catch (error) {
        await bridge?.stop().catch(() => {})
        if (json) {
          writeCliFailure('editor', createCliError(
            'ADV_EDITOR',
            error instanceof EditorBridgeError ? error : new EditorBridgeError(String(error)),
          ))
        }
        else {
          throw error
        }
        process.exitCode = 1
      }
      finally {
        for (const name of signals)
          process.off(name, onSignal)
      }
    },
  )
}
