import { mkdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { digest } from './integrity.mjs'
import { inspectPackedTarball, validatePackageRepository } from './package-archive.mjs'
import { ENTRY_PACKAGES, LAUNCH_VERSION, PACKAGE_SPECS } from './package-specs.mjs'

import { runPnpm as executePnpm } from './run-command.mjs'

export { inspectPackedTarball, readTarEntries } from './package-archive.mjs'
export { ENTRY_PACKAGES, LAUNCH_VERSION, PACKAGE_SPECS } from './package-specs.mjs'

const PUBLIC_DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies']

function sortedObject(value) {
  if (Array.isArray(value))
    return value.map(sortedObject)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortedObject(item)]))
}

async function readPackageJson(root, spec) {
  const filename = resolve(root, spec.path, 'package.json')
  return JSON.parse(await readFile(filename, 'utf8'))
}

export async function validateWorkspacePackageGraph(root) {
  const specsByName = new Map(PACKAGE_SPECS.map((spec, index) => [spec.name, { ...spec, index }]))
  const packages = []

  for (const [index, spec] of PACKAGE_SPECS.entries()) {
    const manifest = await readPackageJson(root, spec)
    if (manifest.name !== spec.name)
      throw new Error(`${spec.path} must publish as ${spec.name}, received ${manifest.name}`)
    if (manifest.version !== LAUNCH_VERSION)
      throw new Error(`${spec.name} must use launch version ${LAUNCH_VERSION}, received ${manifest.version}`)
    if (manifest.private === true)
      throw new Error(`${spec.name} is private and cannot be part of the public launch graph`)
    if (manifest.publishConfig?.access !== 'public')
      throw new Error(`${spec.name} must set publishConfig.access to public`)
    validatePackageRepository(manifest)

    for (const field of PUBLIC_DEPENDENCY_FIELDS) {
      for (const [dependency, version] of Object.entries(manifest[field] || {})) {
        const dependencySpec = specsByName.get(dependency)
        if (!dependencySpec)
          continue
        if (dependencySpec.index >= index)
          throw new Error(`${spec.name} must appear after its public dependency ${dependency}`)
        if (field !== 'peerDependencies' && version !== `workspace:${LAUNCH_VERSION}`)
          throw new Error(`${spec.name} must pin ${dependency} as workspace:${LAUNCH_VERSION}, received ${version}`)
      }
    }

    packages.push(manifest)
  }

  return {
    entries: [...ENTRY_PACKAGES],
    packages,
    version: LAUNCH_VERSION,
    versionStrategy: 'fixed',
  }
}

async function runPnpm(root, args, options = {}) {
  const { stderr, stdout } = await executePnpm(args, {
    cwd: root,
    env: { ...process.env, CI: process.env.CI || '1', NODE_ENV: 'production' },
    maxBuffer: 50 * 1024 * 1024,
  })
  if (options.forwardOutput && stdout)
    process.stderr.write(stdout)
  if (options.forwardOutput && stderr)
    process.stderr.write(stderr)
  return stdout
}

export function parsePnpmJsonOutput(output) {
  const candidates = []
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] === '{' && (index === 0 || output[index - 1] === '\n'))
      candidates.push(index)
  }
  for (const index of candidates.reverse()) {
    try {
      return JSON.parse(output.slice(index).trim())
    }
    catch {}
  }
  throw new Error(`pnpm did not return a JSON document: ${output}`)
}

export async function buildLaunchPackages(root, options = {}) {
  const runner = options.runner || runPnpm
  // The Editor consumes advjs/node during its Nuxt build, while advjs depends on
  // the Editor at install time. Build the Editor last without changing the
  // public dependency order used to pack and publish the packages.
  const buildSpecs = PACKAGE_SPECS.filter(spec => spec.build)
  const orderedSpecs = [
    ...buildSpecs.filter(spec => spec.name !== '@advjs/editor'),
    ...buildSpecs.filter(spec => spec.name === '@advjs/editor'),
  ]
  for (const spec of orderedSpecs)
    await runner(root, ['-C', spec.path, 'build'], { forwardOutput: true })
}

export async function createPackageManifest(options = {}) {
  const root = resolve(options.root || fileURLToPath(new URL('../..', import.meta.url)))
  const outputDirectory = resolve(options.outputDirectory || resolve(root, 'release/packages'))
  const shouldBuild = options.build !== false
  const shouldPack = options.pack !== false
  const graph = await validateWorkspacePackageGraph(root)
  const packages = []

  if (shouldPack)
    await mkdir(outputDirectory, { recursive: true })

  if (shouldPack && shouldBuild)
    await buildLaunchPackages(root)

  for (const [index, spec] of PACKAGE_SPECS.entries()) {
    const workspaceManifest = await readPackageJson(root, spec)
    if (!shouldPack) {
      packages.push({
        dependencies: sortedObject(Object.fromEntries(PUBLIC_DEPENDENCY_FIELDS.flatMap(field => Object.entries(workspaceManifest[field] || {})).filter(([name]) => PACKAGE_SPECS.some(item => item.name === name)))),
        name: spec.name,
        path: spec.path,
        publishOrder: index + 1,
        version: workspaceManifest.version,
      })
      continue
    }

    const output = await runPnpm(root, ['-C', spec.path, 'pack', '--pack-destination', outputDirectory, '--json'])
    const packResult = parsePnpmJsonOutput(output)
    const tarballPath = resolve(packResult.filename)
    const tarball = await readFile(tarballPath)
    const { manifest } = inspectPackedTarball(tarball, spec)
    const publicDependencies = Object.fromEntries(PUBLIC_DEPENDENCY_FIELDS.flatMap(field => Object.entries(manifest[field] || {})).filter(([name]) => PACKAGE_SPECS.some(item => item.name === name)))

    packages.push({
      dependencies: sortedObject(publicDependencies),
      integrity: `sha512-${digest('sha512', tarball, 'base64')}`,
      name: spec.name,
      path: spec.path,
      publishOrder: index + 1,
      size: tarball.length,
      tarball: basename(tarballPath),
      version: manifest.version,
    })
  }

  return sortedObject({
    entries: graph.entries,
    packages,
    schemaVersion: 1,
    version: LAUNCH_VERSION,
    versionStrategy: 'fixed',
  })
}

function readCliOptions(argv) {
  const options = { build: true, pack: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--pack')
      options.pack = true
    else if (argument === '--no-build')
      options.build = false
    else if (argument === '--json')
      options.json = true
    else if (argument === '--output')
      options.outputDirectory = argv[++index]
    else
      throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  try {
    const options = readCliOptions(process.argv.slice(2))
    const manifest = await createPackageManifest(options)
    process.stdout.write(`${JSON.stringify(manifest, null, options.json ? 0 : 2)}\n`)
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exitCode = 1
  }
}
