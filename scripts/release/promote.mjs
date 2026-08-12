#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { verifyReleaseManifest } from './verify-manifest.mjs'

const execFileAsync = promisify(execFile)
const PROMOTION_ACTIONS = ['fast-forward-main', 'verify-pages', 'promote-npm', 'create-tag', 'create-release']
const SHA256_RE = /^[a-f0-9]{64}$/u

function stable(value) {
  if (Array.isArray(value))
    return value.map(stable)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stable(child)]))
}

function eventHash(event) {
  return createHash('sha256').update(JSON.stringify(stable(event))).digest('hex')
}

function createEvent(events, stage, data = {}) {
  const unsigned = {
    data: stable(data),
    manifestIntegrity: data.manifestIntegrity || events[0]?.manifestIntegrity,
    previousHash: events.at(-1)?.hash || null,
    sequence: events.length + 1,
    stage,
    timestamp: new Date().toISOString(),
  }
  return { ...unsigned, hash: eventHash(unsigned) }
}

export function createMemoryTransactionStore() {
  const events = []
  let lock
  return {
    events,
    get locked() {
      return Boolean(lock)
    },
    async acquire(integrity) {
      if (lock && lock !== integrity)
        throw new Error('Another release transaction holds the lock')
      lock = integrity
    },
    async append(stage, data = {}) {
      const event = createEvent(events, stage, data)
      events.push(event)
      return event
    },
    async load() {
      return events
    },
    async release() {
      lock = undefined
    },
  }
}

export function createFileTransactionStore(manifestPath) {
  const absoluteManifest = resolve(manifestPath)
  const lockPath = `${absoluteManifest}.transaction.lock`
  const logPath = `${absoluteManifest}.transaction.jsonl`
  async function load() {
    const content = await readFile(logPath, 'utf8').catch(error => error?.code === 'ENOENT' ? '' : Promise.reject(error))
    const events = content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    for (const [index, event] of events.entries()) {
      const { hash, ...unsigned } = event
      if (hash !== eventHash(unsigned) || event.sequence !== index + 1 || event.previousHash !== (events[index - 1]?.hash || null))
        throw new Error('Release transaction log hash chain is invalid')
    }
    return events
  }
  return {
    lockPath,
    logPath,
    async acquire(integrity) {
      try {
        await writeFile(lockPath, `${integrity}\n`, { flag: 'wx' })
      }
      catch (error) {
        if (error?.code !== 'EEXIST' || (await readFile(lockPath, 'utf8')).trim() !== integrity)
          throw new Error('Another release transaction holds the lock', { cause: error })
      }
    },
    async append(stage, data = {}) {
      const events = await load()
      const event = createEvent(events, stage, data)
      await appendFile(logPath, `${JSON.stringify(event)}\n`, { flag: 'a' })
      return event
    },
    load,
    async release() {
      await rm(lockPath, { force: true })
    },
  }
}

function validateEvidence(evidence, manifest) {
  if (
    !evidence || typeof evidence.approver !== 'string' || !evidence.approver
    || !evidence.approvedAt || Number.isNaN(Date.parse(evidence.approvedAt))
    || evidence.rcSha !== manifest.source.sha
    || typeof evidence.skillRevision !== 'string' || !evidence.skillRevision
    || !SHA256_RE.test(evidence.projectDiffSha256 || '')
    || !SHA256_RE.test(evidence.contentRevision || '')
    || typeof evidence.deploymentId !== 'string' || !evidence.deploymentId
    || !Array.isArray(evidence.scenarios) || evidence.scenarios.length === 0
  ) {
    throw new Error('Promotion requires complete signed RC browser evidence')
  }
  const playUrl = new URL(evidence.playUrl)
  if (playUrl.protocol !== 'https:')
    throw new Error('Promotion evidence play URL must use HTTPS')
  for (const pkg of manifest.packages) {
    if (evidence.packageIntegrities?.[pkg.name] !== pkg.integrity)
      throw new Error(`Promotion evidence integrity for ${pkg.name} does not match the manifest`)
  }
}

function validateBranchProtection(protection) {
  if (
    !protection || protection.allowsDirectHumanPush !== false
    || protection.requireLinearHistory !== true
    || !protection.normalBotActor || protection.normalBotActor !== protection.rollbackBotActor
  ) {
    throw new Error('main branch protection does not enforce the controlled release bot contract')
  }
}

function same(value, expected) {
  return JSON.stringify(stable(value)) === JSON.stringify(stable(expected))
}

function assertInitialState(state, manifest) {
  if (state.mainSha !== manifest.previous.main.sha)
    throw new Error(`main CAS failed: expected ${manifest.previous.main.sha}, received ${state.mainSha}`)
  if (state.pagesDeploymentId !== manifest.previous.pagesProduction.deploymentId)
    throw new Error('Pages production deployment CAS failed')
  for (const [name, tags] of Object.entries(manifest.previous.npmDistTags)) {
    const current = state.npmDistTags[name] || {}
    for (const [tag, version] of Object.entries(tags)) {
      if (tag !== 'rc' && current[tag] !== version)
        throw new Error(`${name} npm dist-tag ${tag} CAS failed`)
    }
  }
  if (state.tagExists || state.releaseExists)
    throw new Error('Target tag or GitHub release already exists before promotion')
}

export async function promoteRelease(options) {
  const manifest = options.manifest || await verifyReleaseManifest({ manifestPath: options.manifestPath, root: options.root })
  if (options.dryRun)
    return { actions: [...PROMOTION_ACTIONS], manifestIntegrity: manifest.integrity, stage: 'dry-run' }
  validateEvidence(options.evidence, manifest)
  const store = options.store || createFileTransactionStore(options.manifestPath)
  const adapter = options.adapter
  await store.acquire(manifest.integrity)
  let events = await store.load()
  let stage = events.at(-1)?.stage

  if (!stage) {
    const current = await adapter.currentState(manifest)
    validateBranchProtection(current.branchProtection)
    assertInitialState(current, manifest)
    await store.append('initialized', { evidence: options.evidence, manifestIntegrity: manifest.integrity })
    stage = 'initialized'
  }
  if (stage === 'aborted')
    throw new Error('This release transaction was aborted and cannot be promoted')
  if (stage === 'initialized') {
    await adapter.fastForwardMain(manifest.previous.main.sha, manifest.target.main.sha)
    await store.append('main-promoted', { sha: manifest.target.main.sha })
    stage = 'main-promoted'
  }
  if (stage === 'main-promoted') {
    const pages = await adapter.waitForPages(manifest.target.pagesProduction.sourceSha, manifest)
    await store.append('pages-verified', pages)
    stage = 'pages-verified'
  }
  if (stage === 'pages-verified') {
    await adapter.promoteNpm(manifest.target.npmDistTags, manifest)
    await store.append('npm-promoted', { distTags: manifest.target.npmDistTags })
    stage = 'npm-promoted'
  }
  if (stage === 'npm-promoted') {
    await adapter.createTag(manifest.target.tag, manifest.target.main.sha, manifest)
    await store.append('tag-created', { sha: manifest.target.main.sha, tag: manifest.target.tag })
    stage = 'tag-created'
  }
  if (stage === 'tag-created') {
    await adapter.createRelease(manifest.target.tag, manifest)
    await store.append('released', { tag: manifest.target.tag })
    stage = 'released'
  }
  if (stage === 'released')
    await store.release()
  events = await store.load()
  return { events, manifestIntegrity: manifest.integrity, stage }
}

export async function abortRelease(options) {
  const manifest = options.manifest || await verifyReleaseManifest({ manifestPath: options.manifestPath, root: options.root })
  if (options.dryRun)
    return { actions: ['restore-npm', 'rollback-pages', 'restore-main'], manifestIntegrity: manifest.integrity, stage: 'dry-run' }
  const store = options.store || createFileTransactionStore(options.manifestPath)
  const adapter = options.adapter
  await store.acquire(manifest.integrity)
  const events = await store.load()
  const lastStage = events.at(-1)?.stage
  const current = await adapter.currentState(manifest)
  if (current.tagExists || current.releaseExists || ['tag-created', 'released'].includes(lastStage))
    throw new Error('Release crossed the irreversible point; abort cannot roll back Git, npm, or Pages')
  if (![manifest.previous.main.sha, manifest.target.main.sha].includes(current.mainSha))
    throw new Error(`main restore CAS failed: expected ${manifest.target.main.sha}, received ${current.mainSha}`)

  if (!same(current.npmDistTags, manifest.previous.npmDistTags))
    await adapter.restoreNpm(manifest.previous.npmDistTags, manifest)
  if (current.pagesDeploymentId !== manifest.previous.pagesProduction.deploymentId)
    await adapter.rollbackPages(manifest.previous.pagesProduction.deploymentId, manifest)
  if (current.mainSha === manifest.target.main.sha)
    await adapter.restoreMain(manifest.target.main.sha, manifest.previous.main.sha, manifest)
  await store.append('aborted', { restoredMain: manifest.previous.main.sha })
  await store.release()
  return { manifestIntegrity: manifest.integrity, stage: 'aborted' }
}

async function run(command, args, options = {}) {
  return (await execFileAsync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  })).stdout.trim()
}

async function commandExists(command, args) {
  try {
    await run(command, args)
    return true
  }
  catch {
    return false
  }
}

export function createCommandReleaseAdapter(options = {}) {
  const repository = options.repository || process.env.GITHUB_REPOSITORY
  const accountId = options.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = options.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN
  const botActor = options.botActor || process.env.ADV_RELEASE_BOT_ACTOR
  if (!repository)
    throw new Error('GITHUB_REPOSITORY is required for release promotion')

  async function npmTags(name) {
    const output = await run('npm', ['view', name, 'dist-tags', '--json'])
    return output ? JSON.parse(output) : {}
  }

  async function pagesDeployments(manifest) {
    const wrangler = await import.meta.resolve('wrangler')
    const output = await run(process.execPath, [new URL(wrangler).pathname, 'pages', 'deployment', 'list', '--project-name', manifest.target.pagesProduction.project, '--environment', 'production', '--json'])
    return JSON.parse(output)
  }

  async function currentState(manifest) {
    const ref = JSON.parse(await run('gh', ['api', `repos/${repository}/git/ref/heads/main`]))
    const protection = JSON.parse(await run('gh', ['api', `repos/${repository}/branches/main/protection`]))
    const deployments = await pagesDeployments(manifest)
    const production = [...deployments].sort((left, right) => String(right.created_on).localeCompare(String(left.created_on)))[0]
    const npmDistTags = Object.fromEntries(await Promise.all(manifest.packages.map(async pkg => [pkg.name, await npmTags(pkg.name)])))
    return {
      branchProtection: {
        allowsDirectHumanPush: (protection.restrictions?.users?.length || 0) > 0 || (protection.restrictions?.teams?.length || 0) > 0,
        normalBotActor: protection.restrictions?.apps?.some(app => app.slug === botActor) ? botActor : undefined,
        requireLinearHistory: protection.required_linear_history?.enabled === true,
        rollbackBotActor: protection.restrictions?.apps?.some(app => app.slug === botActor) ? botActor : undefined,
      },
      mainSha: ref.object.sha,
      npmDistTags,
      pagesDeploymentId: production?.id,
      releaseExists: await commandExists('gh', ['release', 'view', manifest.target.tag, '--repo', repository]),
      tagExists: await commandExists('gh', ['api', `repos/${repository}/git/ref/tags/${manifest.target.tag}`]),
    }
  }

  return {
    currentState,
    async fastForwardMain(expected, target) {
      const state = await currentState(options.manifest)
      if (state.mainSha !== expected)
        throw new Error('main CAS failed before fast-forward')
      await run('gh', ['api', '--method', 'PATCH', `repos/${repository}/git/refs/heads/main`, '-f', `sha=${target}`, '-F', 'force=false'])
    },
    async waitForPages(sourceSha, manifest) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const deployments = await pagesDeployments(manifest)
        const match = deployments.find(deployment => deployment.deployment_trigger?.metadata?.commit_hash === sourceSha && deployment.latest_stage?.status === 'success')
        if (match)
          return { deploymentId: match.id, sourceSha, url: match.url }
        await new Promise(resolveDelay => setTimeout(resolveDelay, 5000))
      }
      throw new Error(`Cloudflare Pages did not produce a successful production deployment for ${sourceSha}`)
    },
    async promoteNpm(target) {
      for (const [name, tags] of Object.entries(target)) {
        const current = await npmTags(name)
        for (const [tag, version] of Object.entries(tags)) {
          if (current[tag] !== version)
            await run('npm', ['dist-tag', 'add', `${name}@${version}`, tag])
        }
      }
    },
    async createTag(tag, sha) {
      if (!await commandExists('gh', ['api', `repos/${repository}/git/ref/tags/${tag}`]))
        await run('gh', ['api', '--method', 'POST', `repos/${repository}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`])
    },
    async createRelease(tag, manifest) {
      if (!await commandExists('gh', ['release', 'view', tag, '--repo', repository]))
        await run('gh', ['release', 'create', tag, '--repo', repository, '--title', tag, '--notes-file', resolve(dirname(options.manifestPath), manifest.artifacts.changelog.path)])
    },
    async restoreNpm(previous, manifest) {
      for (const pkg of manifest.packages) {
        const current = await npmTags(pkg.name)
        const desired = previous[pkg.name] || {}
        for (const [tag, version] of Object.entries(desired)) {
          if (current[tag] !== version)
            await run('npm', ['dist-tag', 'add', `${pkg.name}@${version}`, tag])
        }
        for (const tag of Object.keys(current)) {
          if (!(tag in desired))
            await run('npm', ['dist-tag', 'rm', pkg.name, tag])
        }
      }
    },
    async rollbackPages(deploymentId, manifest) {
      if (!accountId || !apiToken)
        throw new Error('Cloudflare account ID and API token are required for a Pages rollback')
      const response = await (options.fetch || globalThis.fetch)(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${manifest.previous.pagesProduction.project}/deployments/${deploymentId}/rollback`, {
        headers: { 'authorization': `Bearer ${apiToken}`, 'content-type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok)
        throw new Error(`Cloudflare Pages rollback returned HTTP ${response.status}`)
    },
    async restoreMain(expected, previous, manifest) {
      const state = await currentState(manifest)
      if (state.mainSha !== expected)
        throw new Error('main restore CAS failed before non-fast-forward update')
      await run('gh', ['api', '--method', 'PATCH', `repos/${repository}/git/refs/heads/main`, '-f', `sha=${previous}`, '-F', 'force=true'])
    },
  }
}

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
