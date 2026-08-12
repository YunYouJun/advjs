const { createHash, randomUUID } = require('node:crypto')
const process = require('node:process')
const { Writable } = require('node:stream')
const cloud = require('@cloudbase/node-sdk')
const COS = require('cos-nodejs-sdk-v5')
const { AssetError, createAssetService } = require('./service')

const BUCKET = process.env.ADVJS_ASSET_BUCKET || process.env.ADVJS_COS_BUCKET || 'yunlefun-advjs-prod-1325586649'
const REGION = process.env.ADVJS_ASSET_REGION || process.env.ADVJS_COS_REGION || 'ap-shanghai'
const DEFAULT_QUOTA_BYTES = Number(process.env.ADVJS_DEFAULT_QUOTA_BYTES || 5 * 1024 * 1024 * 1024)
const DRIVE_PREVIEW_TOKEN = process.env.ADVJS_DRIVE_PREVIEW_TOKEN || ''

const COLLECTION_ASSETS = 'advjs_assets'
const COLLECTION_PATHS = 'advjs_asset_paths'
const COLLECTION_PROJECTS = 'advjs_projects'
const COLLECTION_QUOTAS = 'advjs_quota_accounts'
const COLLECTION_UPLOADS = 'advjs_asset_uploads'

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()

function resolveUid(context) {
  try {
    const value = cloud.getCloudbaseContext(context) || {}
    if (value.TCB_UUID)
      return String(value.TCB_UUID)
  }
  catch {}
  try {
    const value = app.auth().getUserInfo() || {}
    if (value.uid)
      return String(value.uid)
  }
  catch {}
  return ''
}

function first(result) {
  return result && Array.isArray(result.data) ? result.data[0] : undefined
}

function transactionResult(result) {
  return result && Object.hasOwn(result, 'result') ? result.result : result
}

function createRepository() {
  return {
    async getAssetById(ownerId, assetId) {
      const record = first(await db.collection(COLLECTION_ASSETS).doc(assetId).get())
      return record && record.ownerId === ownerId ? record : undefined
    },
    async getAssetByPath(ownerId, projectId, relativePath) {
      return first(await db.collection(COLLECTION_ASSETS)
        .where({ ownerId, projectId, relativePath, status: 'ready' })
        .limit(1)
        .get())
    },
    async getProjectName(ownerId, projectId) {
      const project = first(await db.collection(COLLECTION_PROJECTS)
        .where({ ownerId, projectId })
        .limit(1)
        .get())
      return project && typeof project.name === 'string' ? project.name : undefined
    },
    async getUpload(ownerId, uploadId) {
      const upload = first(await db.collection(COLLECTION_UPLOADS).doc(uploadId).get())
      return upload && upload.ownerId === ownerId ? upload : undefined
    },
    async listAssets(ownerId, prefix) {
      const result = await db.collection(COLLECTION_ASSETS)
        .where({ ownerId, status: 'ready' })
        .orderBy('updatedAt', 'desc')
        .limit(1000)
        .get()
      return (result.data || [])
        .filter(record => typeof record.key === 'string' && record.key.startsWith(prefix))
        .map(record => ({
          contentType: record.contentType,
          key: record.key,
          lastModified: new Date(record.updatedAt).toISOString(),
          size: record.bytes,
        }))
    },
    async claimDeletion(ownerId, assetId) {
      const result = await db.runTransaction(async (transaction) => {
        const assetRef = transaction.collection(COLLECTION_ASSETS).doc(assetId)
        const asset = first(await assetRef.get())
        if (!asset || asset.ownerId !== ownerId || asset.status !== 'ready')
          return undefined
        if (Number(asset.referenceCount) > 0)
          throw new AssetError('ASSET_IN_USE', 'Asset still has live consumer references')
        if (asset.published)
          throw new AssetError('INVALID_STATE', 'Published assets cannot be removed through source cleanup')
        await assetRef.update({ data: { status: 'deleting', updatedAt: Date.now() } })
        return asset
      })
      return transactionResult(result)
    },
    async restoreAsset(ownerId, assetId) {
      const asset = first(await db.collection(COLLECTION_ASSETS).doc(assetId).get())
      if (asset && asset.ownerId === ownerId && asset.status === 'deleting')
        await db.collection(COLLECTION_ASSETS).doc(assetId).update({ status: 'ready', updatedAt: Date.now() })
    },
    async deleteAsset({ assetId, bytes, ownerId }) {
      const result = await db.runTransaction(async (transaction) => {
        const assetRef = transaction.collection(COLLECTION_ASSETS).doc(assetId)
        const asset = first(await assetRef.get())
        if (!asset || asset.ownerId !== ownerId || asset.status !== 'deleting')
          throw new AssetError('INVALID_STATE', 'Asset deletion claim is no longer active')
        const quotaRef = transaction.collection(COLLECTION_QUOTAS).doc(ownerId)
        const quota = first(await quotaRef.get())
        if (quota) {
          await quotaRef.update({
            data: {
              updatedAt: Date.now(),
              usedBytes: Math.max(0, Number(quota.usedBytes) - bytes),
            },
          })
        }
        if (asset.pathLockId)
          await transaction.collection(COLLECTION_PATHS).doc(asset.pathLockId).delete()
        await assetRef.delete()
        return true
      })
      return transactionResult(result)
    },
    async createUpload(upload, defaultQuotaBytes) {
      const result = await db.runTransaction(async (transaction) => {
        const quotaRef = transaction.collection(COLLECTION_QUOTAS).doc(upload.ownerId)
        const uploadRef = transaction.collection(COLLECTION_UPLOADS).doc(upload.id)
        const pathRef = transaction.collection(COLLECTION_PATHS).doc(upload.pathLockId)
        const [quotaResult, pathResult] = await Promise.all([quotaRef.get(), pathRef.get()])
        const quota = first(quotaResult) || {
          limitBytes: defaultQuotaBytes,
          reservedBytes: 0,
          uid: upload.ownerId,
          usedBytes: 0,
        }
        const path = first(pathResult)
        if (path && path.status === 'uploading' && Number(path.expiresAt) > upload.createdAt)
          throw new AssetError('INVALID_STATE', 'Another upload is already updating this asset')
        const available = Number(quota.limitBytes) - Number(quota.usedBytes) - Number(quota.reservedBytes)
        if (!Number.isSafeInteger(available) || upload.reservedBytes > available)
          throw new AssetError('QUOTA_EXCEEDED', 'AdvJS asset quota exceeded')
        await quotaRef.set({
          data: {
            ...quota,
            limitBytes: Number(quota.limitBytes),
            reservedBytes: Number(quota.reservedBytes) + upload.reservedBytes,
            updatedAt: upload.createdAt,
            usedBytes: Number(quota.usedBytes),
          },
        })
        await pathRef.set({
          data: {
            assetId: upload.assetId,
            expiresAt: upload.expiresAt,
            ownerId: upload.ownerId,
            projectId: upload.projectId,
            relativePath: upload.relativePath,
            status: 'uploading',
            uploadId: upload.id,
            updatedAt: upload.createdAt,
          },
        })
        await uploadRef.set({ data: upload })
        return upload
      })
      return transactionResult(result)
    },
    async cancelUpload({ ownerId, uploadId }) {
      const result = await db.runTransaction(async (transaction) => {
        const uploadRef = transaction.collection(COLLECTION_UPLOADS).doc(uploadId)
        const upload = first(await uploadRef.get())
        if (!upload || upload.ownerId !== ownerId || upload.status !== 'pending')
          return false
        const quotaRef = transaction.collection(COLLECTION_QUOTAS).doc(ownerId)
        const quota = first(await quotaRef.get())
        if (quota) {
          await quotaRef.update({
            data: {
              reservedBytes: Math.max(0, Number(quota.reservedBytes) - Number(upload.reservedBytes)),
              updatedAt: Date.now(),
            },
          })
        }
        await uploadRef.update({ data: { status: 'cancelled', updatedAt: Date.now() } })
        await transaction.collection(COLLECTION_PATHS).doc(upload.pathLockId).update({
          data: { status: 'ready', updatedAt: Date.now() },
        })
        return true
      })
      return transactionResult(result)
    },
    async commitUpload(input) {
      const result = await db.runTransaction(async (transaction) => {
        const uploadRef = transaction.collection(COLLECTION_UPLOADS).doc(input.uploadId)
        const upload = first(await uploadRef.get())
        if (!upload || upload.ownerId !== input.ownerId)
          throw new AssetError('NOT_FOUND', 'Upload was not found')
        if (upload.status === 'completed' && upload.asset)
          return upload.asset
        if (upload.status !== 'pending')
          throw new AssetError('INVALID_STATE', 'Upload is not pending')
        const assetRef = transaction.collection(COLLECTION_ASSETS).doc(input.assetId)
        const previous = first(await assetRef.get())
        const quotaRef = transaction.collection(COLLECTION_QUOTAS).doc(input.ownerId)
        const quota = first(await quotaRef.get())
        if (!quota)
          throw new AssetError('INVALID_STATE', 'Quota account is missing')
        const now = input.updatedAt
        const asset = {
          _id: input.assetId,
          bytes: input.object.bytes,
          contentType: input.object.contentType,
          createdAt: previous ? previous.createdAt : input.createdAt,
          etag: input.object.etag,
          filename: input.filename,
          key: input.key,
          ownerId: input.ownerId,
          pathLockId: upload.pathLockId,
          privateKey: input.privateKey,
          projectId: input.projectId,
          projectName: input.projectName,
          published: previous ? Boolean(previous.published) : false,
          referenceCount: previous ? Number(previous.referenceCount) || 0 : 0,
          relativePath: input.relativePath,
          sha256: input.object.sha256,
          status: 'ready',
          updatedAt: now,
          versionId: input.object.versionId,
        }
        const usedDelta = input.object.bytes - (previous ? Number(previous.bytes) || 0 : 0)
        await assetRef.set({ data: asset })
        await quotaRef.update({
          data: {
            reservedBytes: Math.max(0, Number(quota.reservedBytes) - Number(upload.reservedBytes)),
            updatedAt: now,
            usedBytes: Math.max(0, Number(quota.usedBytes) + usedDelta),
          },
        })
        await transaction.collection(COLLECTION_PATHS).doc(upload.pathLockId).set({
          data: {
            assetId: input.assetId,
            ownerId: input.ownerId,
            projectId: input.projectId,
            relativePath: input.relativePath,
            status: 'ready',
            updatedAt: now,
          },
        })
        await uploadRef.update({ data: { asset, status: 'completed', updatedAt: now } })
        return asset
      })
      return transactionResult(result)
    },
  }
}

function createCos() {
  const SecretId = process.env.TENCENTCLOUD_SECRETID
  const SecretKey = process.env.TENCENTCLOUD_SECRETKEY
  const SecurityToken = process.env.TENCENTCLOUD_SESSIONTOKEN
  if (!SecretId || !SecretKey)
    throw new AssetError('PROVIDER_ERROR', 'Cloud function COS identity is unavailable')
  return new COS({ SecretId, SecretKey, SecurityToken })
}

function callCos(cos, method, params) {
  return new Promise((resolve, reject) => {
    cos[method](params, (error, data) => error ? reject(error) : resolve(data))
  })
}

function safeExtension(filename) {
  const match = String(filename).match(/\.([a-z0-9]{1,12})$/iu)
  return match ? match[1].toLowerCase() : 'bin'
}

function copySource(key) {
  return `${BUCKET}.cos.${REGION}.myqcloud.com/${key.split('/').map(encodeURIComponent).join('/')}`
}

function createStorage() {
  return {
    async cleanupStaging(input) {
      await callCos(createCos(), 'deleteObject', { Bucket: BUCKET, Key: input.stagingKey, Region: REGION })
    },
    async health() {
      await callCos(createCos(), 'headBucket', { Bucket: BUCKET, Region: REGION })
      return { bucket: BUCKET, region: REGION }
    },
    async createUploadGrant(input) {
      const cos = createCos()
      const url = await new Promise((resolve, reject) => {
        cos.getObjectUrl({
          Bucket: BUCKET,
          Expires: Math.max(1, Math.floor((input.expiresAt - Date.now()) / 1000)),
          Headers: {
            'Content-Length': String(input.bytes),
            'Content-Type': input.contentType,
          },
          Key: input.stagingKey,
          Method: 'PUT',
          Region: REGION,
          Sign: true,
        }, (error, data) => error ? reject(error) : resolve(data.Url))
      })
      return {
        expiresAt: new Date(input.expiresAt).toISOString(),
        headers: { 'content-type': input.contentType },
        stagingKey: input.stagingKey,
        url,
      }
    },
    async finalize(input) {
      const cos = createCos()
      const extension = safeExtension(input.filename)
      const privateKey = `private/accounts/${input.ownerId}/projects/${input.projectId}/assets/${input.assetId}/source.${extension}`
      const copied = await callCos(cos, 'copyObject', {
        Bucket: BUCKET,
        CopySource: copySource(input.stagingKey),
        Key: privateKey,
        Region: REGION,
      })
      try {
        const versionId = String(copied.VersionId || '')
        if (!versionId)
          throw new AssetError('PROVIDER_ERROR', 'COS did not return an immutable object version')
        const head = await callCos(cos, 'headObject', {
          Bucket: BUCKET,
          Key: privateKey,
          Region: REGION,
          VersionId: versionId,
        })
        const hash = createHash('sha256')
        const sink = new Writable({
          write(chunk, _encoding, callback) {
            hash.update(chunk)
            callback()
          },
        })
        await callCos(cos, 'getObject', {
          Bucket: BUCKET,
          Key: privateKey,
          Output: sink,
          Region: REGION,
          VersionId: versionId,
        })
        const headers = head.headers || {}
        return {
          bytes: Number(headers['content-length']),
          contentType: String(headers['content-type'] || '').toLowerCase(),
          etag: String(headers.etag || '').replace(/^"|"$/gu, ''),
          privateKey,
          sha256: hash.digest('hex'),
          versionId,
        }
      }
      catch (error) {
        await callCos(cos, 'deleteObject', { Bucket: BUCKET, Key: privateKey, Region: REGION }).catch(() => undefined)
        throw error
      }
    },
    async deletePrivate(input) {
      if (!input.privateKey.startsWith('private/'))
        throw new AssetError('INVALID_STATE', 'Only private source objects can be deleted')
      await callCos(createCos(), 'deleteObject', { Bucket: BUCKET, Key: input.privateKey, Region: REGION })
    },
    async preview(input) {
      const cos = createCos()
      const url = await new Promise((resolve, reject) => {
        cos.getObjectUrl({
          Bucket: BUCKET,
          Expires: Math.max(1, Math.floor((input.expiresAt - Date.now()) / 1000)),
          Key: input.privateKey,
          Method: 'GET',
          ...(input.versionId ? { Query: { versionId: input.versionId } } : {}),
          Region: REGION,
          Sign: true,
        }, (error, data) => error ? reject(error) : resolve(data.Url))
      })
      return { expiresAt: new Date(input.expiresAt).toISOString(), url }
    },
  }
}

const service = createAssetService({
  clock: () => new Date(),
  defaultQuotaBytes: DEFAULT_QUOTA_BYTES,
  drivePreviewToken: DRIVE_PREVIEW_TOKEN,
  id: prefix => `${prefix}_${randomUUID().replace(/-/gu, '')}`,
  repository: createRepository(),
  storage: createStorage(),
})

function failure(error) {
  const known = error instanceof AssetError
  return {
    error: {
      code: known ? error.code : 'INTERNAL',
      message: known ? error.message : 'Asset service failed',
    },
  }
}

exports.main = async (event, context) => {
  const payload = event || {}
  const uid = resolveUid(context)
  try {
    switch (payload.action) {
      case 'health':
        if (!uid)
          throw new AssetError('UNAUTHENTICATED', 'Login required')
        return { bucket: BUCKET, ok: true, region: REGION }
      case 'reserveUpload':
        return { ok: true, upload: await service.reserveUpload(uid, payload) }
      case 'finalizeUpload':
        return { asset: await service.finalizeUpload(uid, payload.uploadId), ok: true }
      case 'listFiles':
        return { files: await service.listFiles(uid, payload.prefix), ok: true }
      case 'createPreview':
        return { ok: true, preview: await service.createUserPreview(uid, payload.key) }
      case 'deleteAsset':
        await service.deleteAsset(uid, payload.key)
        return { ok: true }
      case 'createDrivePreview':
        return { ok: true, preview: await service.createDrivePreview(payload) }
      case 'serviceHealth':
        return { ok: true, storage: await service.serviceHealth(payload) }
      default:
        throw new AssetError('INVALID_INPUT', `Unknown action: ${String(payload.action)}`)
    }
  }
  catch (error) {
    console.error('[advjsAssets]', error && error.code ? error.code : 'INTERNAL', error && error.message)
    return failure(error)
  }
}
