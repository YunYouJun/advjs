import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { LAUNCH_VERSION, PACKAGE_SPECS } from './package-specs.mjs'

export const NPM_REGISTRY = 'https://registry.npmjs.org'
export const NPM_WORKFLOW = 'release-npm.yml'
export const NPM_CLI_VERSION = '11.21.0'
export const NPM_REPOSITORY = 'YunYouJun/advjs'

function command(binary, args, capture = false) {
  const result = spawnSync(binary, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (result.error)
    throw result.error
  assert.equal(result.status, 0, `${binary} ${args[0]} failed${capture ? `: ${result.stderr}` : ''}`)
  return result.stdout?.trim()
}

export function assertOidcEnvironment(environment = process.env) {
  assert.equal(environment.GITHUB_ACTIONS, 'true', 'Publication requires GitHub Actions OIDC')
  assert.equal(environment.GITHUB_REPOSITORY, NPM_REPOSITORY)
  assert.equal(environment.GITHUB_EVENT_NAME, 'workflow_dispatch')
  assert(environment.GITHUB_WORKFLOW_REF?.startsWith(`${NPM_REPOSITORY}/.github/workflows/${NPM_WORKFLOW}@refs/heads/`))
  assert(environment.ACTIONS_ID_TOKEN_REQUEST_URL && environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'Missing id-token: write')
  assert(!environment.NODE_AUTH_TOKEN && !environment.NPM_TOKEN, 'Use OIDC without a static npm token')
}

export async function verifyNpmArtifact(directory) {
  const manifest = JSON.parse(await readFile(join(directory, 'packages.json'), 'utf8'))
  assert.equal(manifest.version, LAUNCH_VERSION)
  assert.match(manifest.sourceSha, /^[a-f0-9]{40}$/u)
  assert.deepEqual(manifest.packages.map(pkg => pkg.name), PACKAGE_SPECS.map(pkg => pkg.name))
  for (const pkg of manifest.packages) {
    assert.equal(pkg.version, manifest.version)
    assert.equal(pkg.tarball, basename(pkg.tarball), 'Tarballs must stay within the artifact directory')
    const archive = await readFile(join(directory, pkg.tarball))
    assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, pkg.integrity, `${pkg.name}: tarball integrity mismatch`)
  }
  return manifest
}

export function verifySourceChecks(checks, statuses = []) {
  assert(checks.some(check => check.name === 'launch-required' && check.conclusion === 'success'), 'The exact source must pass launch-required')
  for (const check of checks)
    assert(check.status === 'completed' && ['success', 'neutral', 'skipped'].includes(check.conclusion), `Source check is not passing: ${check.name}`)
  for (const status of statuses)
    assert.equal(status.state, 'success', `Source status is not passing: ${status.context}`)
}

function verifyGitHubSource(sourceSha) {
  const runs = JSON.parse(command('gh', ['api', `repos/${NPM_REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${sourceSha}&per_page=20`], true))
  const run = runs.workflow_runs.find(item => item.head_sha === sourceSha)
  assert(run?.status === 'completed' && run.conclusion === 'success', 'The exact source must have a successful ADV.JS CI run')
  const jobs = JSON.parse(command('gh', ['api', `repos/${NPM_REPOSITORY}/actions/runs/${run.id}/jobs?per_page=100`], true))
  const statuses = JSON.parse(command('gh', ['api', `repos/${NPM_REPOSITORY}/commits/${sourceSha}/status`], true))
  verifySourceChecks(jobs.jobs, statuses.statuses)
}

async function metadata(pkg) {
  const response = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(pkg.name)}`, { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } })
  if (response.status === 404)
    return null
  assert.equal(response.status, 200, `${pkg.name}: registry status`)
  return response.json()
}

export async function reusePublishedNpmArchives(manifest, directory, options = {}) {
  const lookup = options.lookup || metadata
  const download = options.download || (async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
    assert.equal(response.status, 200)
    return Buffer.from(await response.arrayBuffer())
  })
  const reused = []
  for (const pkg of manifest.packages) {
    const existing = (await lookup(pkg))?.versions?.[pkg.version]
    if (!existing || existing.dist.integrity === pkg.integrity)
      continue
    const archive = await download(existing.dist.tarball)
    assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, existing.dist.integrity)
    const local = await readFile(join(directory, pkg.tarball))
    // gzip's OS byte differs on macOS/Linux. Reuse an immutable public archive
    // only when the complete uncompressed tar stream is byte-for-byte equal.
    assert(gunzipSync(local).equals(gunzipSync(archive)), `${pkg.name}: existing immutable version has different package contents`)
    reused.push({ name: pkg.name, builtIntegrity: pkg.integrity, publishedIntegrity: existing.dist.integrity })
    await writeFile(join(directory, pkg.tarball), archive)
    pkg.integrity = existing.dist.integrity
    pkg.size = archive.length
  }
  if (reused.length)
    manifest.reusedPublishedArchives = reused
  return manifest
}

export async function uploadNpmPackages(manifest, options) {
  const { lookup, publish, accepted, save } = options
  // OIDC cannot create a package name. Check the entire graph before writing.
  const remotePackages = await Promise.all(manifest.packages.map(lookup))
  assert(remotePackages.every(Boolean), 'Initialize all new package names and their trusted publishers before OIDC publication')
  for (const [index, pkg] of manifest.packages.entries()) {
    const published = remotePackages[index].versions?.[pkg.version]
    if (published)
      assert.equal(published.dist.integrity, pkg.integrity, `${pkg.name}: existing immutable version differs`)
    if (accepted[pkg.name]) {
      assert.equal(accepted[pkg.name].version, pkg.version)
      assert.equal(accepted[pkg.name].integrity, pkg.integrity)
    }
  }
  for (const [index, pkg] of manifest.packages.entries()) {
    const published = remotePackages[index].versions?.[pkg.version]
    if (published) {
      assert.equal(published.dist.integrity, pkg.integrity, `${pkg.name}: existing immutable version differs`)
      continue
    }
    if (accepted[pkg.name]) {
      assert.equal(accepted[pkg.name].integrity, pkg.integrity)
      continue
    }
    await publish(pkg)
    accepted[pkg.name] = { version: pkg.version, integrity: pkg.integrity, acceptedAt: new Date().toISOString() }
    await save()
  }
}

async function verifyPublicPackages(manifest) {
  for (const pkg of manifest.packages) {
    const deadline = Date.now() + 30 * 60 * 1000
    let published
    let attempt = 0
    while (Date.now() < deadline) {
      published = (await metadata(pkg))?.versions?.[pkg.version]
      if (published)
        break
      if (attempt++ % 6 === 0)
        console.log(`Waiting for npm scanning: ${pkg.name}@${pkg.version}`)
      await new Promise(resolveDelay => setTimeout(resolveDelay, 10000))
    }
    assert(published, `${pkg.name}: npm has not made the accepted upload available; inspect its scan status`)
    assert.equal(published.dist.integrity, pkg.integrity)
    const archive = await fetch(published.dist.tarball, { signal: AbortSignal.timeout(60000) })
    assert.equal(archive.status, 200)
    assert.equal(`sha512-${createHash('sha512').update(Buffer.from(await archive.arrayBuffer())).digest('base64')}`, pkg.integrity)
    console.log(`Verified public archive: ${pkg.name}@${pkg.version}`)
  }
}

async function main(operation, directory) {
  directory = resolve(directory || 'release/npm')
  if (operation === 'prepare') {
    assert.equal(command('git', ['rev-parse', 'HEAD'], true), process.env.GITHUB_SHA)
    verifyGitHubSource(process.env.GITHUB_SHA)
    const { createPackageManifest } = await import('./package-manifest.mjs')
    await mkdir(directory, { recursive: true })
    const manifest = await createPackageManifest({ outputDirectory: directory })
    manifest.sourceSha = process.env.GITHUB_SHA
    await reusePublishedNpmArchives(manifest, directory)
    await writeFile(join(directory, 'packages.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await verifyNpmArtifact(directory)
    return
  }
  if (['check-run', 'check-publication-run'].includes(operation)) {
    assert.match(process.env.NPM_CANDIDATE_RUN_ID || '', /^\d+$/u)
    const run = JSON.parse(command('gh', ['api', `repos/${NPM_REPOSITORY}/actions/runs/${process.env.NPM_CANDIDATE_RUN_ID}`], true))
    if (operation === 'check-run')
      assert.equal(run.conclusion, 'success')
    else
      assert.equal(run.status, 'completed')
    assert.equal(run.event, 'workflow_dispatch')
    assert.equal(run.path, `.github/workflows/${NPM_WORKFLOW}`)
    assert.equal(run.head_sha, process.env.GITHUB_SHA, 'Publish from the candidate commit so provenance describes the packaged source')
    return
  }
  assert(['publish', 'promote'].includes(operation))
  assertOidcEnvironment()
  const manifest = await verifyNpmArtifact(directory)
  assert.equal(manifest.sourceSha, process.env.GITHUB_SHA)
  verifyGitHubSource(manifest.sourceSha)
  const npm = args => command('pnpm', ['dlx', `npm@${NPM_CLI_VERSION}`, ...args, `--registry=${NPM_REGISTRY}`])
  if (operation === 'publish') {
    const ledgerPath = join(directory, 'publication.json')
    const ledger = await readFile(ledgerPath, 'utf8').then(JSON.parse).catch((error) => {
      if (error.code !== 'ENOENT')
        throw error
      return { sourceSha: manifest.sourceSha, accepted: {} }
    })
    assert.equal(ledger.sourceSha, manifest.sourceSha)
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
    await uploadNpmPackages(manifest, {
      accepted: ledger.accepted,
      lookup: metadata,
      publish: pkg => npm(['publish', join(directory, pkg.tarball), '--tag', 'rc', '--access', 'public']),
      save: () => writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`),
    })
  }
  await verifyPublicPackages(manifest)
  if (operation === 'promote') {
    // create-adv stays last, after its entire dependency graph is public.
    for (const pkg of manifest.packages) {
      if ((await metadata(pkg))?.['dist-tags']?.latest !== pkg.version)
        npm(['dist-tag', 'add', `${pkg.name}@${pkg.version}`, 'latest'])
      let tags
      for (let attempt = 0; attempt < 60; attempt++) {
        tags = (await metadata(pkg))?.['dist-tags']
        if (tags?.latest === pkg.version)
          break
        await new Promise(resolveDelay => setTimeout(resolveDelay, 5000))
      }
      assert.equal(tags?.latest, pkg.version)
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
