#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promoteRelease } from './promotion-transaction.mjs'
import { createCommandReleaseAdapter } from './release-adapter.mjs'
import { verifyReleaseManifest } from './verify-manifest.mjs'

export {
  abortRelease,
  createFileTransactionStore,
  createMemoryTransactionStore,
  promoteRelease,
} from './promotion-transaction.mjs'
export { createCommandReleaseAdapter } from './release-adapter.mjs'

function parseCliOptions(argv) {
  if (!argv[0])
    throw new TypeError('Usage: promote.mjs <manifest> [--evidence file] [--dry-run]')
  const options = { manifestPath: resolve(argv[0]) }
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--evidence')
      options.evidencePath = resolve(argv[++index])
    else if (argv[index] === '--dry-run')
      options.dryRun = true
    else
      throw new TypeError(`Unknown option: ${argv[index]}`)
  }
  return options
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  const cli = parseCliOptions(process.argv.slice(2))
  const manifest = await verifyReleaseManifest({ manifestPath: cli.manifestPath, root: process.cwd() }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exit(1)
  })
  const evidence = cli.evidencePath ? JSON.parse(await readFile(cli.evidencePath, 'utf8')) : undefined
  const adapter = cli.dryRun ? undefined : createCommandReleaseAdapter({ manifest, manifestPath: cli.manifestPath })
  promoteRelease({ adapter, dryRun: cli.dryRun, evidence, manifest, manifestPath: cli.manifestPath })
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
      process.exitCode = 1
    })
}
