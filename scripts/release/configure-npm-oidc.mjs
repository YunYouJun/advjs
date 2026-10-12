import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { NPM_CLI_VERSION, NPM_REGISTRY, NPM_REPOSITORY, NPM_WORKFLOW, verifyNpmArtifact } from './npm-oidc.mjs'
import { readTarEntries } from './package-archive.mjs'

export function npmTrustConfiguration() {
  return {
    type: 'github',
    claims: { repository: NPM_REPOSITORY, workflow_ref: { file: NPM_WORKFLOW } },
    permissions: ['createPackage', 'manageDistTags'],
  }
}

function run(binary, args) {
  const result = spawnSync(binary, args, { stdio: 'inherit' })
  if (result.error)
    throw result.error
  assert.equal(result.status, 0, `${binary} ${args[0]} failed`)
}

async function main(directory) {
  assert(directory, 'Usage: pnpm exec node scripts/release/configure-npm-oidc.mjs <downloaded npm artifact directory>')
  directory = resolve(directory)
  const manifest = await verifyNpmArtifact(directory)
  const tools = join(directory, '.npm-tools')
  await mkdir(tools, { recursive: true })
  await writeFile(join(tools, 'package.json'), JSON.stringify({ private: true, packageManager: 'pnpm@11.20.0' }))
  await writeFile(join(tools, 'pnpm-workspace.yaml'), JSON.stringify({ allowBuilds: {} }))
  run('pnpm', ['--dir', tools, 'add', `npm@${NPM_CLI_VERSION}`, '--ignore-scripts'])

  // Pin npm's config/2FA implementation together. The trust API supports
  // manageDistTags; npm trust's flags do not yet expose that permission.
  const npmRoot = join(tools, 'node_modules/npm')
  const require = createRequire(join(npmRoot, 'package.json'))
  const npmCli = join(npmRoot, 'bin/npm-cli.js')
  const identity = spawnSync(process.execPath, [npmCli, 'whoami', `--registry=${NPM_REGISTRY}`], { stdio: 'inherit' })
  if (identity.status !== 0)
    run(process.execPath, [npmCli, 'login', `--registry=${NPM_REGISTRY}`])
  const Npm = require('./lib/npm.js')
  const npm = new Npm({ argv: [`--registry=${NPM_REGISTRY}`] })
  await npm.load()
  const fetch = require('npm-registry-fetch')
  const publish = require('libnpmpublish').publish
  const { otplease } = require('./lib/utils/auth.js')
  const options = { ...npm.flatOptions, registry: NPM_REGISTRY }
  const otpRequest = request => otplease(npm, options, request)
  const publicMetadata = async (pkg) => {
    const response = await globalThis.fetch(`${NPM_REGISTRY}/${encodeURIComponent(pkg.name)}`, { signal: AbortSignal.timeout(30000) })
    if (response.status === 404)
      return null
    assert.equal(response.status, 200)
    return response.json()
  }
  const ledgerPath = join(directory, 'bootstrap.json')
  const ledger = await readFile(ledgerPath, 'utf8').then(JSON.parse).catch((error) => {
    if (error.code !== 'ENOENT')
      throw error
    return { sourceSha: manifest.sourceSha, accepted: {} }
  })
  assert.equal(ledger.sourceSha, manifest.sourceSha)

  for (const pkg of manifest.packages) {
    const existing = (await publicMetadata(pkg))?.versions?.[pkg.version]
    if (existing)
      assert.equal(existing.dist.integrity, pkg.integrity, `${pkg.name}: existing immutable version differs`)
  }

  for (const pkg of manifest.packages) {
    if (await publicMetadata(pkg))
      continue
    if (ledger.accepted[pkg.name]) {
      assert.equal(ledger.accepted[pkg.name].integrity, pkg.integrity)
      continue
    }
    const archive = await readFile(join(directory, pkg.tarball))
    const entries = readTarEntries(archive)
    const packageJson = JSON.parse(entries.get('package/package.json').toString('utf8'))
    const readme = [...entries].find(([path]) => /^package\/readme(?:\.md|\.markdown|\.mdown)?$/iu.test(path))?.[1]
    if (readme)
      packageJson.readme = readme.toString('utf8')
    console.log(`Initialize new package name: ${pkg.name}@${pkg.version}`)
    await otpRequest(opts => publish(packageJson, archive, { ...opts, access: 'public', defaultTag: 'rc' }))
    ledger.accepted[pkg.name] = { version: pkg.version, integrity: pkg.integrity, acceptedAt: new Date().toISOString() }
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
  }

  const configuration = npmTrustConfiguration()
  const configured = []
  for (const pkg of manifest.packages) {
    const deadline = Date.now() + 30 * 60 * 1000
    while (!await publicMetadata(pkg)) {
      assert(Date.now() < deadline, `${pkg.name}: npm has not exposed the new package name; retry after scanning`)
      console.log(`Waiting for npm scanning: ${pkg.name}`)
      await new Promise(resolveDelay => setTimeout(resolveDelay, 10000))
    }
    const endpoint = `/-/package/${encodeURIComponent(pkg.name)}/trust`
    const existing = await otpRequest(opts => fetch.json(endpoint, opts))
    const match = existing.find(item => item.type === configuration.type
      && item.claims.repository === NPM_REPOSITORY
      && item.claims.workflow_ref.file === NPM_WORKFLOW
      && !item.claims.environment)
    if (match) {
      assert(configuration.permissions.every(permission => match.permissions?.includes(permission)), `${pkg.name}: matching configuration lacks publish/dist-tag permission; review its settings`)
      configured.push({ name: pkg.name, configuration: match })
    }
    else {
      const created = await otpRequest(opts => fetch.json(endpoint, { ...opts, method: 'POST', body: [configuration] }))
      configured.push({ name: pkg.name, configuration: created })
    }
    console.log(`Configured OIDC publish and dist-tags: ${pkg.name}`)
    await writeFile(join(directory, 'trust-settings.json'), `${JSON.stringify(configured, null, 2)}\n`)
    await new Promise(resolveDelay => setTimeout(resolveDelay, 2000))
  }
  console.log(`OIDC setup complete for ${configured.length} packages; dispatch the publish operation from ${manifest.sourceSha}`)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv[2]).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
