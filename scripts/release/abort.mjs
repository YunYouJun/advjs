#!/usr/bin/env node

import { resolve } from 'node:path'
import process from 'node:process'
import { abortRelease, createCommandReleaseAdapter } from './promote.mjs'
import { verifyReleaseManifest } from './verify-manifest.mjs'

async function main() {
  const manifestPath = process.argv[2] ? resolve(process.argv[2]) : undefined
  const dryRun = process.argv.includes('--dry-run')
  if (!manifestPath)
    throw new TypeError('Usage: abort.mjs <manifest> [--dry-run]')
  const manifest = await verifyReleaseManifest({ manifestPath, root: process.cwd() })
  const adapter = dryRun ? undefined : createCommandReleaseAdapter({ manifest, manifestPath })
  return await abortRelease({ adapter, dryRun, manifest, manifestPath })
}

main()
  .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exitCode = 1
  })
