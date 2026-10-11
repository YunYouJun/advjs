import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { closeSync, constants, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { open, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'

const providerIds = ['openai-tts', 'qwen-tts']
const markerName = '.advjs-audio-volume.json'
const hash = value => createHash('sha256').update(value).digest('hex')
function fail(code) {
  throw new Error(code)
}
function record(value, fields, code = 'ADV_AUDIO_DEPLOY_CONFIG_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key)))
    fail(code)
}
function text(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 256
}
function identifier(value) {
  return text(value) && /^[\w.:-]{1,128}$/u.test(value) && value !== '.' && value !== '..'
}
function absolute(value) {
  return text(value) && isAbsolute(value) && !/[\r\n\\]/u.test(value) && resolve(value) === value
}
function inside(root, target) {
  const path = relative(root, target)
  return !isAbsolute(path) && path !== '..' && !path.startsWith('../')
}
function relativeFile(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 2048 && !isAbsolute(value) && !/[\\:]/u.test(value) && !value.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))
}
function prefix(value) {
  return text(value) && /^[a-zA-Z0-9][\w.-]*(?:\/[a-zA-Z0-9][\w.-]*)*$/u.test(value) && !value.split('/').some(part => ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))
}

/** The operator controls this finite JSON; no HTTP request can change it. */
export function validateAudioServiceConfiguration(raw, runtime = process) {
  record(raw, ['schemaVersion', 'cloudbase', 'host', 'port', 'allowedOrigins', 'allowedHosts', 'persistence', 'stateDirectory', 'projects', 'publication'])
  if (raw.schemaVersion !== 1 || !['127.0.0.1', '::1', '0.0.0.0', '::'].includes(raw.host) || !Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535)
    fail('ADV_AUDIO_DEPLOY_CONFIG_INVALID')
  record(raw.cloudbase, ['envId'])
  if (!text(raw.cloudbase.envId) || raw.cloudbase.envId.length > 63 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(raw.cloudbase.envId))
    fail('ADV_AUDIO_DEPLOY_AUTH_INVALID')
  if (!Array.isArray(raw.allowedOrigins) || !raw.allowedOrigins.length || raw.allowedOrigins.length > 20 || !Array.isArray(raw.allowedHosts) || !raw.allowedHosts.length || raw.allowedHosts.length > 20)
    fail('ADV_AUDIO_DEPLOY_ORIGIN_INVALID')
  for (const origin of raw.allowedOrigins) {
    let url
    try {
      url = new URL(origin)
    }
    catch {
      fail('ADV_AUDIO_DEPLOY_ORIGIN_INVALID')
    }
    if (url.origin !== origin || url.protocol !== 'https:' || url.hostname.includes('*'))
      fail('ADV_AUDIO_DEPLOY_ORIGIN_INVALID')
  }
  for (const host of raw.allowedHosts) {
    let url
    try {
      url = new URL(`https://${host}`)
    }
    catch {
      fail('ADV_AUDIO_DEPLOY_HOST_INVALID')
    }
    if (!text(host) || host.includes('*') || url.host !== host || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      fail('ADV_AUDIO_DEPLOY_HOST_INVALID')
  }
  record(raw.persistence, ['root', 'volumeId', 'singleInstance'])
  if (!absolute(raw.persistence.root) || !identifier(raw.persistence.volumeId) || raw.persistence.singleInstance !== true || !absolute(raw.stateDirectory) || raw.stateDirectory === raw.persistence.root || !inside(raw.persistence.root, raw.stateDirectory))
    fail('ADV_AUDIO_DEPLOY_PERSISTENCE_REQUIRED')
  if (!Array.isArray(raw.projects) || !raw.projects.length || raw.projects.length > 100)
    fail('ADV_AUDIO_DEPLOY_PROJECT_INVALID')
  const roots = [raw.stateDirectory]
  const scopes = new Set()
  for (const project of raw.projects) {
    record(project, ['accountId', 'projectId', 'root', 'voice'])
    if (!identifier(project.accountId) || !identifier(project.projectId) || !absolute(project.root) || project.root === raw.persistence.root || !inside(raw.persistence.root, project.root)
      || roots.some(root => inside(root, project.root) || inside(project.root, root))) {
      fail('ADV_AUDIO_DEPLOY_PROJECT_ISOLATION_REQUIRED')
    }
    const scope = JSON.stringify([project.accountId, project.projectId])
    if (scopes.has(scope))
      fail('ADV_AUDIO_DEPLOY_PROJECT_ISOLATION_REQUIRED')
    scopes.add(scope)
    roots.push(project.root)
    const voice = project.voice
    record(voice, ['providers', 'defaultProvider', 'presets', 'presetProviders', 'defaultPreset'])
    if (!Array.isArray(voice.providers) || !voice.providers.length || new Set(voice.providers).size !== voice.providers.length || voice.providers.some(id => !providerIds.includes(id)) || !voice.providers.includes(voice.defaultProvider))
      fail('ADV_AUDIO_DEPLOY_PROVIDER_INVALID')
    if (voice.providers.includes('qwen-tts') && (runtime.platform !== 'darwin' || runtime.arch !== 'arm64'))
      fail('ADV_AUDIO_DEPLOY_QWEN_HOST_UNSUPPORTED')
    if (!voice.presets || typeof voice.presets !== 'object' || Array.isArray(voice.presets) || !Object.keys(voice.presets).length || Object.keys(voice.presets).length > 20
      || !voice.presetProviders || typeof voice.presetProviders !== 'object' || Array.isArray(voice.presetProviders)
      || !Object.hasOwn(voice.presets, voice.defaultPreset) || Object.keys(voice.presetProviders).length !== Object.keys(voice.presets).length) {
      fail('ADV_AUDIO_DEPLOY_PRESET_INVALID')
    }
    for (const [id, path] of Object.entries(voice.presets)) {
      if (!identifier(id) || !relativeFile(path) || !path.startsWith('authoring/voices/') || !path.endsWith('.json') || !voice.providers.includes(voice.presetProviders[id]))
        fail('ADV_AUDIO_DEPLOY_PRESET_INVALID')
    }
  }
  if (raw.publication !== undefined) {
    const publication = raw.publication
    record(publication, ['bucket', 'region', 'publicBaseUrl', 'deploymentPrefix', 'approvedToolchains', 'stsDirectory'])
    let url
    try {
      url = new URL(publication.publicBaseUrl)
    }
    catch {
      fail('ADV_AUDIO_DEPLOY_PUBLICATION_INVALID')
    }
    if (!text(publication.bucket) || !/^[a-z0-9][a-z0-9-]*-\d{5,20}$/u.test(publication.bucket) || !text(publication.region) || !/^[a-z]+-[a-z]+(?:-\d+)?$/u.test(publication.region)
      || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !prefix(publication.deploymentPrefix)
      || !absolute(publication.approvedToolchains) || !absolute(publication.stsDirectory) || raw.projects.some(project => inside(project.root, publication.stsDirectory) || inside(project.root, publication.approvedToolchains))) {
      fail('ADV_AUDIO_DEPLOY_PUBLICATION_INVALID')
    }
  }
  return structuredClone(raw)
}

export function audioServiceProjectScope(configuration, accountId, projectId) {
  return `${configuration.publication.deploymentPrefix}/${hash(JSON.stringify([accountId, projectId]))}`
}

export async function readAudioServiceJson(path, maxBytes = 64 * 1024, privateFile = false) {
  if (!absolute(path) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 * 1024)
    fail('ADV_AUDIO_DEPLOY_FILE_INVALID')
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size > maxBytes || (privateFile && process.platform !== 'win32' && (info.mode & 0o077) !== 0))
      fail('ADV_AUDIO_DEPLOY_FILE_INVALID')
    const bytes = Buffer.alloc(maxBytes + 1)
    let total = 0
    while (total <= maxBytes) {
      const { bytesRead } = await file.read(bytes, total, bytes.length - total)
      if (!bytesRead)
        break
      total += bytesRead
    }
    if (total > maxBytes)
      fail('ADV_AUDIO_DEPLOY_FILE_INVALID')
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, total)))
    }
    catch {
      fail('ADV_AUDIO_DEPLOY_JSON_INVALID')
    }
  }
  finally {
    await file.close()
  }
}

async function temporaryVolume(root) {
  const paths = await Promise.all([tmpdir(), '/tmp', '/var/tmp', '/run', '/dev/shm'].map(path => realpath(path).catch(() => undefined)))
  return paths.some(path => path && inside(path, root))
}

/** Explicit initialization only accepts an existing empty volume; never repairs author data. */
export async function prepareAudioServiceVolume(path, volumeId) {
  if (!absolute(path) || !identifier(volumeId))
    fail('ADV_AUDIO_DEPLOY_PERSISTENCE_REQUIRED')
  const root = await realpath(path)
  const info = await stat(root)
  if (root !== path || !info.isDirectory() || await temporaryVolume(root) || (await readdir(root)).length)
    fail('ADV_AUDIO_DEPLOY_EMPTY_PERSISTENT_VOLUME_REQUIRED')
  await writeFile(resolve(root, markerName), `${JSON.stringify({ schemaVersion: 1, volumeId, device: String(info.dev) })}\n`, { flag: 'wx', mode: 0o600 })
}

export async function verifyAudioServiceVolume(configuration) {
  const root = await realpath(configuration.persistence.root)
  const info = await stat(root)
  const marker = await readAudioServiceJson(resolve(root, markerName))
  record(marker, ['schemaVersion', 'volumeId', 'device'], 'ADV_AUDIO_DEPLOY_VOLUME_INVALID')
  if (root !== configuration.persistence.root || !info.isDirectory() || await temporaryVolume(root)
    || marker.schemaVersion !== 1 || marker.volumeId !== configuration.persistence.volumeId || marker.device !== String(info.dev)) {
    fail('ADV_AUDIO_DEPLOY_VOLUME_INVALID')
  }
  for (const path of [configuration.stateDirectory, ...configuration.projects.map(project => project.root)]) {
    if (await realpath(path) !== path || !(await stat(path)).isDirectory())
      fail('ADV_AUDIO_DEPLOY_VOLUME_INVALID')
  }
  if (configuration.publication) {
    const { stsDirectory, approvedToolchains } = configuration.publication
    if (await realpath(stsDirectory) !== stsDirectory || !(await stat(stsDirectory)).isDirectory() || await realpath(approvedToolchains) !== approvedToolchains)
      fail('ADV_AUDIO_DEPLOY_VOLUME_INVALID')
  }
}

/** A stale lock is deliberately not auto-reaped; the operator verifies shutdown first. */
export function acquireAudioServiceInstance(stateDirectory) {
  const path = resolve(stateDirectory, '.audio-service.instance.lock')
  const token = randomUUID()
  let handle
  try {
    handle = openSync(path, 'wx', 0o600)
  }
  catch {
    fail('ADV_AUDIO_DEPLOY_SINGLE_INSTANCE_REQUIRED')
  }
  try {
    writeFileSync(handle, `${JSON.stringify({ pid: process.pid, token })}\n`)
  }
  finally {
    closeSync(handle)
  }
  const release = () => {
    try {
      if (JSON.parse(readFileSync(path, 'utf8')).token === token)
        unlinkSync(path)
    }
    catch {}
  }
  process.once('exit', release)
  return () => {
    process.removeListener('exit', release)
    release()
  }
}

/** The operator refreshes per-project STS files atomically; every new scope reads current credentials. */
export function createScopedStsAuthorization({ bucket, region, projectPrefix, readCredentials, now = () => Math.floor(Date.now() / 1000) }) {
  return (request, callback) => {
    void (async () => {
      const bucketVersioning = request.Key === '' && request.Method === 'GET' && Object.hasOwn(request.Query ?? {}, 'versioning') && Object.keys(request.Query).length === 1
      if (request.Bucket !== bucket || request.Region !== region || (!bucketVersioning && (!['GET', 'HEAD', 'PUT'].includes(request.Method) || !request.Key?.startsWith(`${projectPrefix}/`) || !relativeFile(request.Key) || Object.keys(request.Query ?? {}).length)))
        fail('ADV_AUDIO_DEPLOY_STS_SCOPE_REQUIRED')
      const grant = await readCredentials()
      record(grant, ['bucket', 'region', 'projectPrefix', 'TmpSecretId', 'TmpSecretKey', 'SecurityToken', 'StartTime', 'ExpiredTime'], 'ADV_AUDIO_DEPLOY_STS_INVALID')
      if (grant.bucket !== bucket || grant.region !== region || grant.projectPrefix !== projectPrefix || !text(grant.TmpSecretId) || !text(grant.TmpSecretKey)
        || typeof grant.SecurityToken !== 'string' || !grant.SecurityToken.length || grant.SecurityToken.length > 8192 || Array.from(grant.SecurityToken).some(character => character.charCodeAt(0) < 33 || character.charCodeAt(0) > 126)
        || !Number.isSafeInteger(grant.StartTime) || !Number.isSafeInteger(grant.ExpiredTime) || grant.StartTime < 1_000_000_000 || grant.ExpiredTime >= 10_000_000_000 || grant.StartTime > now() + 30 || grant.ExpiredTime <= now() + 60 || grant.ExpiredTime <= grant.StartTime) {
        fail('ADV_AUDIO_DEPLOY_STS_INVALID')
      }
      callback({ TmpSecretId: grant.TmpSecretId, TmpSecretKey: grant.TmpSecretKey, SecurityToken: grant.SecurityToken, StartTime: grant.StartTime, ExpiredTime: grant.ExpiredTime, ScopeLimit: true })
    })().catch(() => callback({})) // Existing COS SDK rejects empty credentials; no secret-bearing errors escape.
  }
}
