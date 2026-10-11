#!/usr/bin/env node
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { prepareAudioServiceVolume } from './configuration.mjs'

async function main() {
  const [command, ...args] = process.argv.slice(2)
  try {
    if (command === 'prepare-volume' && args.length === 2) {
      await prepareAudioServiceVolume(args[0], args[1])
      process.stdout.write(`${JSON.stringify({ event: 'volume-prepared' })}\n`)
    }
    else if (command === 'serve' && args.length === 0) {
      const cli = fileURLToPath(new URL('../../bin/audio-server.mjs', import.meta.resolve('advjs/node')))
      const child = spawn(process.execPath, [cli, fileURLToPath(new URL('./config.mjs', import.meta.url))], { stdio: 'inherit', env: process.env })
      for (const signal of ['SIGINT', 'SIGTERM'])
        process.once(signal, () => child.kill(signal))
      child.once('error', () => {
        console.error('ADV_AUDIO_DEPLOY_CLI_FAILED')
        process.exitCode = 1
      })
      child.once('exit', (code, signal) => {
        process.exitCode = code ?? (signal ? 1 : 0)
      })
    }
    else {
      console.error('Usage: node entrypoint.mjs prepare-volume <existing-empty-absolute-root> <volume-id> | serve')
      process.exitCode = 1
    }
  }
  catch (error) {
    console.error(error instanceof Error && /^[A-Z][A-Z0-9_]+$/u.test(error.message) ? error.message : 'ADV_AUDIO_DEPLOY_START_FAILED')
    process.exitCode = 1
  }
}
void main()
