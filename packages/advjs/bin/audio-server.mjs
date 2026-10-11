#!/usr/bin/env node
import { realpath } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createStudioVoiceService } from '../dist/node/index.mjs'

// Only the operator chooses this trusted module. No route accepts a config path.
async function main() {
  const configuration = process.argv[2]
  if (!configuration || process.argv.length !== 3) {
    console.error('Usage: adv-audio-server <trusted-server-config.mjs>')
    process.exitCode = 1
    return
  }
  try {
    const path = await realpath(configuration)
    const imported = await import(pathToFileURL(path).href)
    const options = typeof imported.default === 'function' ? await imported.default() : imported.default
    const service = await createStudioVoiceService(options)
    const { url } = await service.start()
    process.stdout.write(`${JSON.stringify({ event: 'ready', url })}\n`)
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        void service.stop().finally(() => process.exit())
      })
    }
  }
  catch (error) {
    const code = error instanceof Error ? error.message.match(/^([A-Z][A-Z0-9_]{0,79})(?::|$)/u)?.[1] : undefined
    console.error(code ?? 'ADV_AUDIO_SERVICE_START_FAILED')
    process.exitCode = 1
  }
}
void main()
