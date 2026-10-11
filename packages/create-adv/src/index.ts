import process from 'node:process'
import consola from 'consola'
import { init } from './cli'

init().catch((error) => {
  consola.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
