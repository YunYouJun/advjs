import { appendFile, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { sha256 } from './integrity.mjs'
import { verifyReleaseManifest } from './verify-manifest.mjs'

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
  return sha256(JSON.stringify(stable(event)))
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
