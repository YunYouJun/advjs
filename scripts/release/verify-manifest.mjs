#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { calculateReleaseManifestIntegrity } from './create-manifest.mjs'

const execFileAsync = promisify(execFile)

function digest(algorithm, content, encoding = 'hex') {
  return createHash(algorithm).update(content).digest(encoding)
}

async function verifyRegistryPackage(pkg, registry, fetchImpl) {
  const url = `${registry.replace(/\/$/u, '')}/${encodeURIComponent(pkg.name)}`
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } })
  if (!response.ok)
    throw new Error(`Registry metadata for ${pkg.name} returned HTTP ${response.status}`)
  const metadata = await response.json()
  const published = metadata.versions?.[pkg.version]
  if (!published)
    throw new Error(`${pkg.name}@${pkg.version} is not present in ${registry}`)
  if (published.dist?.integrity !== pkg.integrity)
    throw new Error(`${pkg.name}@${pkg.version} registry integrity does not match the release manifest`)
}

export async function verifyReleaseManifest(options) {
  const manifestPath = resolve(options.manifestPath)
  const manifestDirectory = dirname(manifestPath)
  const root = resolve(options.root || process.cwd())
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || manifest.status !== 'candidate' || !Array.isArray(manifest.packages))
    throw new Error('Release manifest does not match schema version 1')
  if (calculateReleaseManifestIntegrity(manifest) !== manifest.integrity)
    throw new Error('Release manifest integrity does not match its contents')

  for (const [name, artifact] of Object.entries(manifest.artifacts || {})) {
    if (!artifact || typeof artifact.path !== 'string' || typeof artifact.sha256 !== 'string')
      throw new Error(`Release manifest artifact ${name} is invalid`)
    const content = await readFile(resolve(manifestDirectory, artifact.path))
    if (digest('sha256', content) !== artifact.sha256)
      throw new Error(`Release artifact ${name} does not match its SHA-256`)
  }

  const packageManifest = JSON.parse(await readFile(resolve(manifestDirectory, manifest.artifacts.packageManifest.path), 'utf8'))
  if (packageManifest.version !== manifest.version || packageManifest.packages.length !== manifest.packages.length)
    throw new Error('Package manifest does not match the release manifest')
  for (const pkg of manifest.packages) {
    if (!pkg.tarball || !pkg.integrity)
      throw new Error(`${pkg.name} has no immutable tarball metadata`)
    const tarball = await readFile(resolve(manifestDirectory, pkg.tarball))
    const integrity = `sha512-${digest('sha512', tarball, 'base64')}`
    if (integrity !== pkg.integrity)
      throw new Error(`${pkg.name} tarball integrity does not match the release manifest`)
  }

  if (options.checkGit !== false) {
    for (const identity of [manifest.previous?.main, manifest.source, manifest.target?.main]) {
      if (!identity?.sha || !identity?.tree)
        throw new Error('Release manifest is missing a Git commit identity')
      const tree = (await execFileAsync('git', ['show', '-s', '--format=%T', identity.sha], { cwd: root })).stdout.trim()
      if (tree !== identity.tree)
        throw new Error(`Git tree for ${identity.sha} does not match the release manifest`)
    }
  }

  if (options.registry) {
    const fetchImpl = options.fetch || globalThis.fetch
    for (const pkg of manifest.packages)
      await verifyRegistryPackage(pkg, options.registry, fetchImpl)
  }
  return manifest
}

function parseOptions(argv) {
  if (!argv[0] || argv[0].startsWith('--'))
    throw new TypeError('Usage: verify-manifest.mjs <manifest> [--local-registry [url] | --registry [url]]')
  const options = { manifestPath: argv[0] }
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--local-registry') {
      const candidate = argv[index + 1]
      options.registry = candidate && !candidate.startsWith('--') ? argv[++index] : process.env.ADV_LOCAL_REGISTRY || 'http://127.0.0.1:4873'
    }
    else if (argument === '--registry') {
      const candidate = argv[index + 1]
      options.registry = candidate && !candidate.startsWith('--') ? argv[++index] : 'https://registry.npmjs.org'
    }
    else if (argument === '--no-git') {
      options.checkGit = false
    }
    else {
      throw new TypeError(`Unknown option: ${argument}`)
    }
  }
  return options
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  verifyReleaseManifest({ ...parseOptions(process.argv.slice(2)), root: process.cwd() })
    .then(manifest => process.stdout.write(`${JSON.stringify({ integrity: manifest.integrity, status: 'verified', version: manifest.version })}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
      process.exitCode = 1
    })
}
