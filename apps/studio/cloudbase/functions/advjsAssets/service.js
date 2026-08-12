const { Buffer } = require('node:buffer')
const { createHash, timingSafeEqual } = require('node:crypto')

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024
const UPLOAD_TTL_MS = 15 * 60 * 1000
const PREVIEW_TTL_MS = 5 * 60 * 1000
const PROJECT_ROOT = 'adv-projects/'

class AssetError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function requiredUid(uid) {
  if (typeof uid !== 'string' || !uid || uid.length > 128 || /[\\/\p{Cc}]/u.test(uid) || uid === '.' || uid === '..')
    throw new AssetError('UNAUTHENTICATED', 'Login required')
  return uid
}

function parseKey(value) {
  if (typeof value !== 'string' || !value.startsWith(PROJECT_ROOT) || value.length > 2048 || /\\|\p{Cc}/u.test(value))
    throw new AssetError('INVALID_INPUT', 'Asset key must be under adv-projects/')
  const segments = value.split('/')
  if (segments.length < 3 || segments.some(segment => !segment || segment === '.' || segment === '..'))
    throw new AssetError('INVALID_INPUT', 'Asset key must include a project and relative path')
  const projectId = segments[1]
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(projectId))
    throw new AssetError('INVALID_INPUT', 'Project identifier is invalid')
  return {
    filename: segments.at(-1),
    key: value,
    projectId,
    relativePath: segments.slice(2).join('/'),
  }
}

function requiredContentType(value) {
  if (typeof value !== 'string' || value.length > 128 || !/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*(?:; charset=utf-8)?$/iu.test(value))
    throw new AssetError('INVALID_INPUT', 'Content type is invalid')
  return value.toLowerCase()
}

function requiredBytes(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UPLOAD_BYTES)
    throw new AssetError('INVALID_INPUT', `Asset must be between 0 and ${MAX_UPLOAD_BYTES} bytes`)
  return value
}

function equalSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !actual || actual.length !== expected.length)
    return false
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

function previewKind(contentType) {
  if (contentType.startsWith('image/'))
    return 'image'
  if (contentType.startsWith('video/'))
    return 'video'
  if (contentType.startsWith('audio/'))
    return 'audio'
  return 'download'
}

function createAssetService(dependencies) {
  const { clock, defaultQuotaBytes, drivePreviewToken, id, repository, storage } = dependencies
  if (!Number.isSafeInteger(defaultQuotaBytes) || defaultQuotaBytes <= 0 || typeof drivePreviewToken !== 'string' || !drivePreviewToken)
    throw new AssetError('INVALID_INPUT', 'Asset service configuration is invalid')

  async function reserveUpload(uid, input) {
    const ownerId = requiredUid(uid)
    const parsed = parseKey(input && input.key)
    const bytes = requiredBytes(input && input.bytes)
    const contentType = requiredContentType(input && input.contentType)
    const uploadId = id('upl')
    const createdAt = clock().getTime()
    const expiresAt = createdAt + UPLOAD_TTL_MS
    const existing = await repository.getAssetByPath(ownerId, parsed.projectId, parsed.relativePath)
    const assetId = existing && existing._id ? String(existing._id) : id('ast')
    const pathLockId = createHash('sha256').update(`${ownerId}\0${parsed.projectId}\0${parsed.relativePath}`).digest('hex')
    const stagingKey = `staging/accounts/${ownerId}/uploads/${uploadId}/source`
    const upload = {
      assetId,
      bytes,
      contentType,
      createdAt,
      existingBytes: existing ? Number(existing.bytes) || 0 : 0,
      expiresAt,
      filename: parsed.filename,
      id: uploadId,
      key: parsed.key,
      ownerId,
      pathLockId,
      projectId: parsed.projectId,
      relativePath: parsed.relativePath,
      reservedBytes: bytes,
      stagingKey,
      status: 'pending',
      updatedAt: createdAt,
    }
    await repository.createUpload(upload, defaultQuotaBytes)
    try {
      const grant = await storage.createUploadGrant({
        bytes,
        contentType,
        expiresAt,
        ownerId,
        stagingKey,
        uploadId,
      })
      return {
        expiresAt: grant.expiresAt,
        headers: grant.headers,
        projectId: parsed.projectId,
        relativePath: parsed.relativePath,
        uploadId,
        url: grant.url,
      }
    }
    catch (error) {
      await repository.cancelUpload({ ownerId, uploadId }).catch(() => undefined)
      throw error
    }
  }

  async function finalizeUpload(uid, uploadId) {
    const ownerId = requiredUid(uid)
    if (typeof uploadId !== 'string' || !uploadId)
      throw new AssetError('INVALID_INPUT', 'Upload identifier is required')
    const upload = await repository.getUpload(ownerId, uploadId)
    if (!upload)
      throw new AssetError('NOT_FOUND', 'Upload was not found')
    if (upload.status === 'completed' && upload.asset) {
      if (storage.cleanupStaging)
        await storage.cleanupStaging({ stagingKey: upload.stagingKey }).catch(() => undefined)
      return upload.asset
    }
    if (upload.status !== 'pending' || Number(upload.expiresAt) <= clock().getTime())
      throw new AssetError('INVALID_STATE', 'Upload is not pending')
    const object = await storage.finalize({
      assetId: upload.assetId,
      createdAt: upload.createdAt,
      existingBytes: upload.existingBytes,
      filename: upload.filename,
      key: upload.key,
      ownerId,
      projectId: upload.projectId,
      stagingKey: upload.stagingKey,
    })
    if (object.bytes !== upload.bytes || object.contentType !== upload.contentType || !/^[a-f0-9]{64}$/u.test(object.sha256)
      || typeof object.versionId !== 'string' || !object.versionId) {
      throw new AssetError('INTEGRITY_MISMATCH', 'Uploaded object does not match its reservation')
    }
    const projectName = repository.getProjectName
      ? await repository.getProjectName(ownerId, upload.projectId) || upload.projectId
      : upload.projectId
    const asset = await repository.commitUpload({
      assetId: upload.assetId,
      filename: upload.filename,
      object,
      ownerId,
      privateKey: object.privateKey,
      projectId: upload.projectId,
      projectName,
      relativePath: upload.relativePath,
      uploadId,
      updatedAt: clock().getTime(),
    })
    if (storage.cleanupStaging)
      await storage.cleanupStaging({ stagingKey: upload.stagingKey }).catch(() => undefined)
    return asset
  }

  async function createDrivePreview(input) {
    if (!input || !equalSecret(input.serviceToken, drivePreviewToken))
      throw new AssetError('FORBIDDEN', 'Drive preview delegation was rejected')
    const ownerId = requiredUid(input.ownerId)
    if (typeof input.assetId !== 'string' || !input.assetId)
      throw new AssetError('INVALID_INPUT', 'Asset identifier is required')
    const asset = await repository.getAssetById(ownerId, input.assetId)
    if (!asset || asset.status !== 'ready')
      throw new AssetError('NOT_FOUND', 'Asset was not found')
    const grant = await storage.preview({
      expiresAt: clock().getTime() + PREVIEW_TTL_MS,
      privateKey: asset.privateKey,
      versionId: asset.versionId,
    })
    return {
      expiresAt: grant.expiresAt,
      kind: previewKind(asset.contentType),
      status: 'ready',
      url: grant.url,
    }
  }

  async function serviceHealth(input) {
    if (!input || !equalSecret(input.serviceToken, drivePreviewToken))
      throw new AssetError('FORBIDDEN', 'Storage diagnostics were rejected')
    return storage.health()
  }

  async function listFiles(uid, prefix = PROJECT_ROOT) {
    const ownerId = requiredUid(uid)
    const segments = typeof prefix === 'string' ? prefix.replace(/\/$/u, '').split('/') : []
    if (typeof prefix !== 'string' || !prefix.startsWith(PROJECT_ROOT) || prefix.length > 2048 || /\\|\p{Cc}/u.test(prefix)
      || segments.some(segment => !segment || segment === '.' || segment === '..')
      || (segments[1] && !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(segments[1]))) {
      throw new AssetError('INVALID_INPUT', 'Asset prefix is invalid')
    }
    return repository.listAssets(ownerId, prefix)
  }

  async function createUserPreview(uid, key) {
    const ownerId = requiredUid(uid)
    const parsed = parseKey(key)
    const asset = await repository.getAssetByPath(ownerId, parsed.projectId, parsed.relativePath)
    if (!asset || asset.status !== 'ready')
      throw new AssetError('NOT_FOUND', 'Asset was not found')
    const grant = await storage.preview({
      expiresAt: clock().getTime() + PREVIEW_TTL_MS,
      privateKey: asset.privateKey,
      versionId: asset.versionId,
    })
    return { expiresAt: grant.expiresAt, url: grant.url }
  }

  async function deleteAsset(uid, key) {
    const ownerId = requiredUid(uid)
    const parsed = parseKey(key)
    const found = await repository.getAssetByPath(ownerId, parsed.projectId, parsed.relativePath)
    if (!found || found.status !== 'ready')
      throw new AssetError('NOT_FOUND', 'Asset was not found')
    if (Number(found.referenceCount) > 0)
      throw new AssetError('ASSET_IN_USE', 'Asset still has live consumer references')
    if (found.published)
      throw new AssetError('INVALID_STATE', 'Published assets cannot be removed through source cleanup')
    if (typeof found.privateKey !== 'string' || !found.privateKey.startsWith('private/'))
      throw new AssetError('INVALID_STATE', 'Asset has no deletable private source')
    const claimed = repository.claimDeletion
      ? await repository.claimDeletion(ownerId, found._id)
      : found
    if (!claimed)
      throw new AssetError('INVALID_STATE', 'Asset deletion could not be claimed')
    try {
      await storage.deletePrivate({ privateKey: found.privateKey })
      await repository.deleteAsset({
        assetId: found._id,
        bytes: Number(found.bytes) || 0,
        ownerId,
      })
    }
    catch (error) {
      if (repository.restoreAsset)
        await repository.restoreAsset(ownerId, found._id).catch(() => undefined)
      throw error
    }
  }

  return {
    createDrivePreview,
    createUserPreview,
    deleteAsset,
    finalizeUpload,
    listFiles,
    reserveUpload,
    serviceHealth,
  }
}

module.exports = {
  AssetError,
  MAX_UPLOAD_BYTES,
  createAssetService,
}
