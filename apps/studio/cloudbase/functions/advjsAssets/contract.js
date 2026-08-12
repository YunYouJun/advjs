const path = require('node:path')

const PROJECT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/u
const ASSET_ID_RE = /^[a-z0-9][a-z0-9_/-]{0,127}$/u
const KIND_RE = /^[a-z][a-z0-9_-]{0,31}$/u
const PRINCIPAL_RE = /^[\w-]{1,128}$/u
const UPLOAD_ID_RE = /^[\w-]{1,128}$/u
const FILE_NAME_RE = /^[^/\\\0]{1,128}$/u
const SHA256_RE = /^[a-f0-9]{64}$/u
const MIME_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u
const ASSET_TYPES = new Set(['image', 'audio', 'video', 'font', 'model', 'data'])

const TYPE_MIME_PREFIXES = {
  image: ['image/'],
  audio: ['audio/'],
  video: ['video/'],
  font: ['font/', 'application/font-', 'application/vnd.ms-fontobject'],
  model: ['model/', 'application/octet-stream', 'application/gltf+json'],
  data: ['application/', 'text/'],
}

function invalid(message) {
  throw new Error(`ADV_ASSET_UPLOAD_INVALID: ${message}`)
}

function requiredString(value, name) {
  if (typeof value !== 'string' || !value)
    invalid(`${name} is required`)
  return value
}

function assertPrincipal(value, name) {
  const principal = requiredString(value, name)
  if (!PRINCIPAL_RE.test(principal))
    invalid(`${name} is invalid`)
  return principal
}

function assertMimeMatchesType(type, mimeType) {
  const prefixes = TYPE_MIME_PREFIXES[type]
  if (!prefixes.some(prefix => mimeType.startsWith(prefix)))
    invalid(`mimeType ${mimeType} does not match asset type ${type}`)
}

function normalizeUploadRequest(input) {
  const request = input && typeof input === 'object' ? input : {}
  const projectId = requiredString(request.projectId, 'projectId')
  const assetId = requiredString(request.assetId, 'assetId')
  const fileName = requiredString(request.fileName, 'fileName')
  const kind = requiredString(request.kind, 'kind')
  const type = requiredString(request.type, 'type')
  const mimeType = requiredString(request.mimeType, 'mimeType').toLowerCase()
  const sha256 = requiredString(request.sha256, 'sha256').toLowerCase()
  const bytes = Number(request.bytes)

  if (!PROJECT_ID_RE.test(projectId) || projectId.includes('..'))
    invalid('projectId is invalid')
  if (!ASSET_ID_RE.test(assetId) || assetId.includes('..') || assetId.includes('//'))
    invalid('assetId is invalid')
  if (!FILE_NAME_RE.test(fileName) || fileName === '.' || fileName === '..')
    invalid('fileName is invalid')
  if (!KIND_RE.test(kind))
    invalid('kind is invalid')
  if (!ASSET_TYPES.has(type))
    invalid('type is invalid')
  if (!Number.isSafeInteger(bytes) || bytes <= 0)
    invalid('bytes must be a positive integer')
  if (!MIME_RE.test(mimeType))
    invalid('mimeType is invalid')
  if (!SHA256_RE.test(sha256))
    invalid('sha256 is invalid')
  assertMimeMatchesType(type, mimeType)

  return { projectId, assetId, fileName, kind, type, bytes, mimeType, sha256 }
}

function extensionFor(request) {
  const extension = path.extname(request.fileName).slice(1).toLowerCase()
  if (extension && /^[a-z0-9]{1,10}$/u.test(extension))
    return extension
  const subtype = request.mimeType.split('/')[1].replace(/^x-/u, '').replace(/[^a-z0-9]+/gu, '-')
  return subtype || 'bin'
}

function buildStagingObjectKey(ownerId, uploadId, fileName) {
  const owner = assertPrincipal(ownerId, 'ownerId')
  const upload = requiredString(uploadId, 'uploadId')
  if (!UPLOAD_ID_RE.test(upload))
    invalid('uploadId is invalid')
  if (!FILE_NAME_RE.test(fileName))
    invalid('fileName is invalid')
  return `staging/accounts/${owner}/uploads/${upload}/${fileName}`
}

function buildFinalObjectKey(ownerId, input) {
  const owner = assertPrincipal(ownerId, 'ownerId')
  const request = normalizeUploadRequest(input)
  return `private/accounts/${owner}/projects/${request.projectId}/assets/${request.assetId}/${request.sha256}.${extensionFor(request)}`
}

function publicAssetRecord(record) {
  return {
    id: record.assetId,
    kind: record.kind,
    type: record.type,
    sha256: record.sha256,
    bytes: record.bytes,
    mimeType: record.mimeType,
  }
}

module.exports = {
  buildFinalObjectKey,
  buildStagingObjectKey,
  normalizeUploadRequest,
  publicAssetRecord,
}
