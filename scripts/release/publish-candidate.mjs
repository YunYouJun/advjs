#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { verifyReleaseManifest } from './verify-manifest.mjs'

const execFileAsync = promisify(execFile)

async function publishedIntegrity(pkg, registry, fetchImpl) {
  const response = await fetchImpl(`${registry.replace(/\/$/u, '')}/${encodeURIComponent(pkg.name)}`, {
    headers: { accept: 'application/json' },
  })
  if (response.status === 404)
    return undefined
  if (!response.ok)
    throw new Error(`Registry metadata for ${pkg.name} returned HTTP ${response.status}`)
  return (await response.json()).versions?.[pkg.version]?.dist?.integrity
}

export async function publishCandidate(options) {
  const manifestPath = resolve(options.manifestPath)
  const registry = options.registry
  if (!registry)
    throw new TypeError('Candidate publication requires an explicit registry URL')
  const fetchImpl = options.fetch || globalThis.fetch
  const run = options.run || (async (tarball) => {
    await execFileAsync('npm', ['publish', tarball, '--tag', 'rc', '--access', 'public', '--registry', registry], {
      cwd: dirname(manifestPath),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    })
  })
  const manifest = await verifyReleaseManifest({ checkGit: options.checkGit, manifestPath, root: options.root })
  const results = []
  for (const pkg of manifest.packages) {
    const currentIntegrity = await publishedIntegrity(pkg, registry, fetchImpl)
    if (currentIntegrity) {
      if (currentIntegrity !== pkg.integrity)
        throw new Error(`${pkg.name}@${pkg.version} already exists with different integrity`)
      results.push({ name: pkg.name, status: 'already-published', version: pkg.version })
      continue
    }
    if (!options.dryRun)
      await run(resolve(dirname(manifestPath), pkg.tarball), pkg)
    results.push({ name: pkg.name, status: options.dryRun ? 'would-publish' : 'published', version: pkg.version })
  }
  return { packages: results, registry, version: manifest.version }
}

function parseOptions(argv) {
  if (!argv[0])
    throw new TypeError('Usage: publish-candidate.mjs <manifest> --registry <url> [--dry-run]')
  const options = { manifestPath: argv[0] }
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--registry')
      options.registry = argv[++index]
    else if (argv[index] === '--dry-run')
      options.dryRun = true
    else if (argv[index] === '--no-git')
      options.checkGit = false
    else
      throw new TypeError(`Unknown option: ${argv[index]}`)
  }
  return options
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  publishCandidate(parseOptions(process.argv.slice(2)))
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
      process.exitCode = 1
    })
}
