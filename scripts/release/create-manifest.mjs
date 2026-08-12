#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { generateChangelog } from './changelog.mjs'
import { sha256 } from './integrity.mjs'
import { createPackageManifest } from './package-manifest.mjs'

const execFileAsync = promisify(execFile)
const SHA_RE = /^[a-f0-9]{40}$/u
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u

function sorted(value) {
  if (Array.isArray(value))
    return value.map(sorted)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sorted(child)]))
}

export function serializeReleaseJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`
}

export function calculateReleaseManifestIntegrity(manifest) {
  const { integrity: _integrity, ...unsigned } = manifest
  return `sha256-${sha256(serializeReleaseJson(unsigned))}`
}

async function git(root, args) {
  return (await execFileAsync('git', args, { cwd: root, maxBuffer: 10 * 1024 * 1024 })).stdout.trim()
}

async function commitIdentity(root, sha) {
  if (!SHA_RE.test(sha))
    throw new TypeError(`Expected an exact 40-character Git SHA, received ${sha}`)
  await git(root, ['cat-file', '-e', `${sha}^{commit}`])
  return { sha, tree: await git(root, ['show', '-s', '--format=%T', sha]) }
}

function validateState(state) {
  if (
    !state || state.schemaVersion !== 1
    || !state.main || !SHA_RE.test(state.main.sha) || !SHA_RE.test(state.main.tree)
    || !state.npmDistTags || typeof state.npmDistTags !== 'object'
    || !state.pagesProduction || typeof state.pagesProduction.project !== 'string'
    || typeof state.pagesProduction.deploymentId !== 'string'
  ) {
    throw new TypeError('Release state snapshot does not match schema version 1')
  }
  return state
}

async function writeImmutable(path, content) {
  try {
    await writeFile(path, content, { flag: 'wx' })
  }
  catch (error) {
    if (error?.code !== 'EEXIST')
      throw error
    if (await readFile(path, 'utf8') !== content)
      throw new Error(`Immutable release artifact already exists with different content: ${path}`)
  }
}

export async function createReleaseManifest(options) {
  const root = resolve(options.root || process.cwd())
  const output = resolve(options.output)
  const existing = await readFile(output, 'utf8').catch(error => error?.code === 'ENOENT' ? undefined : Promise.reject(error))
  if (existing) {
    const manifest = JSON.parse(existing)
    if (manifest.source?.sha !== options.sourceSha || manifest.version !== options.version)
      throw new Error('Existing immutable release manifest belongs to another source or version')
    const { verifyReleaseManifest } = await import('./verify-manifest.mjs')
    await verifyReleaseManifest({ manifestPath: output, root })
    return manifest
  }
  if (!VERSION_RE.test(options.version))
    throw new TypeError(`Invalid release version: ${options.version}`)

  const source = await commitIdentity(root, options.sourceSha)
  const head = await git(root, ['rev-parse', 'HEAD'])
  if (head !== source.sha)
    throw new Error(`Release checkout must be the exact source SHA ${source.sha}; current HEAD is ${head}`)
  const state = validateState(options.state || JSON.parse(await readFile(resolve(options.statePath), 'utf8')))
  const main = await commitIdentity(root, state.main.sha)
  if (main.tree !== state.main.tree)
    throw new Error('Release state main tree does not match Git')
  await git(root, ['merge-base', '--is-ancestor', main.sha, source.sha])

  const outputDirectory = dirname(output)
  const packagesDirectory = resolve(outputDirectory, 'packages')
  await mkdir(packagesDirectory, { recursive: true })
  const packageManifestFactory = options.packageManifestFactory || createPackageManifest
  const packageManifest = await packageManifestFactory({
    build: true,
    outputDirectory: packagesDirectory,
    pack: true,
    root,
  })
  if (packageManifest.version !== options.version)
    throw new Error(`Package manifest version ${packageManifest.version} does not match release ${options.version}`)
  const packageManifestPath = resolve(outputDirectory, 'packages.json')
  const packageManifestContent = serializeReleaseJson(packageManifest)
  await writeImmutable(packageManifestPath, packageManifestContent)

  const changelogPath = resolve(outputDirectory, 'changelog.md')
  const changelog = await (options.changelogFactory || generateChangelog)({
    from: main.sha,
    root,
    to: source.sha,
    version: options.version,
  })
  await writeImmutable(changelogPath, changelog)
  const knownLimitationsPath = resolve(root, options.knownLimitations || 'docs/about/launch-known-limitations.md')
  const knownLimitations = await readFile(knownLimitationsPath)

  const previousDistTags = Object.fromEntries(packageManifest.packages.map(pkg => [pkg.name, sorted(state.npmDistTags[pkg.name] || {})]))
  const targetDistTags = Object.fromEntries(packageManifest.packages.map(pkg => [pkg.name, { latest: options.version, rc: options.version }]))
  const packages = packageManifest.packages.map(pkg => ({
    ...pkg,
    ...(pkg.tarball ? { tarball: `packages/${pkg.tarball}` } : {}),
  }))
  const unsigned = {
    schemaVersion: 1,
    status: 'candidate',
    version: options.version,
    createdAt: options.createdAt || new Date().toISOString(),
    source: { ref: 'dev', ...source },
    previous: {
      main,
      npmDistTags: previousDistTags,
      pagesProduction: sorted(state.pagesProduction),
    },
    target: {
      main: source,
      npmDistTags: targetDistTags,
      pagesProduction: {
        deploymentId: null,
        project: state.pagesProduction.project,
        sourceSha: source.sha,
      },
      tag: `v${options.version}`,
    },
    artifacts: {
      changelog: { path: relative(outputDirectory, changelogPath), sha256: sha256(changelog) },
      knownLimitations: { path: relative(outputDirectory, knownLimitationsPath), sha256: sha256(knownLimitations) },
      packageManifest: { path: relative(outputDirectory, packageManifestPath), sha256: sha256(packageManifestContent) },
    },
    packages,
  }
  const manifest = { ...unsigned, integrity: calculateReleaseManifestIntegrity(unsigned) }
  await writeImmutable(output, serializeReleaseJson(manifest))
  return manifest
}

function parseOptions(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--source-sha')
      options.sourceSha = argv[++index]
    else if (argument === '--version')
      options.version = argv[++index]
    else if (argument === '--state')
      options.statePath = argv[++index]
    else if (argument === '--output')
      options.output = argv[++index]
    else if (argument === '--known-limitations')
      options.knownLimitations = argv[++index]
    else
      throw new TypeError(`Unknown option: ${argument}`)
  }
  for (const required of ['sourceSha', 'version', 'statePath', 'output']) {
    if (!options[required])
      throw new TypeError(`Missing required option --${required.replace(/[A-Z]/gu, match => `-${match.toLowerCase()}`)}`)
  }
  return options
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  createReleaseManifest({ ...parseOptions(process.argv.slice(2)), root: process.cwd() })
    .then(manifest => process.stdout.write(`${JSON.stringify({ integrity: manifest.integrity, manifest: resolve(parseOptions(process.argv.slice(2)).output), version: manifest.version })}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
      process.exitCode = 1
    })
}
