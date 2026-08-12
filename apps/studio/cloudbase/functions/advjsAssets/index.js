/**
 * advjsAssets — managed, account-isolated asset uploads for ADV.JS Studio.
 *
 * The browser never receives COS credentials. It asks this Event Function for a
 * short-lived URL that authorizes one PUT to one staging key, then asks the
 * function to verify the object and promote it into the private catalog.
 */

const { Buffer } = require('node:buffer')
const crypto = require('node:crypto')
const process = require('node:process')
const cloud = require('@cloudbase/node-sdk')
const COS = require('cos-nodejs-sdk-v5')
const {
  buildFinalObjectKey,
  buildStagingObjectKey,
  normalizeUploadRequest,
  publicAssetRecord,
} = require('./contract')

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()
const uploads = db.collection('advjs_asset_uploads')
const assets = db.collection('advjs_assets')

const BUCKET = process.env.ADVJS_ASSET_BUCKET || 'yunlefun-advjs-prod-1325586649'
const REGION = process.env.ADVJS_ASSET_REGION || 'ap-shanghai'
const RESERVATION_SECONDS = Math.min(Math.max(Number(process.env.ADVJS_ASSET_PUT_TTL || 900), 60), 1800)
const PREVIEW_SECONDS = Math.min(Math.max(Number(process.env.ADVJS_ASSET_PREVIEW_TTL || 300), 60), 1800)
const HASH_CHUNK_BYTES = Math.min(Math.max(Number(process.env.ADVJS_ASSET_HASH_CHUNK_BYTES || 8 * 1024 * 1024), 1024 * 1024), 32 * 1024 * 1024)
const MAX_PENDING_UPLOADS = Math.min(Math.max(Number(process.env.ADVJS_ASSET_MAX_PENDING || 20), 1), 100)
const MAX_BYTES = {
  image: 50 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  font: 25 * 1024 * 1024,
  model: 250 * 1024 * 1024,
  data: 10 * 1024 * 1024,
}

function fail(message) {
  return { error: message }
}

function resolveUid(context) {
  try {
    const value = cloud.getCloudbaseContext(context) || {}
    if (value.TCB_UUID)
      return String(value.TCB_UUID)
  }
  catch {}
  return ''
}

function createCosClient() {
  const SecretId = process.env.TENCENTCLOUD_SECRETID || process.env.TENCENT_COS_SECRET_ID
  const SecretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.TENCENT_COS_SECRET_KEY
  const SecurityToken = process.env.TENCENTCLOUD_SESSIONTOKEN || process.env.TENCENT_COS_SESSION_TOKEN
  if (!SecretId || !SecretKey)
    throw new Error('COS server credentials or a bound runtime role are required')
  return new COS({ SecretId, SecretKey, SecurityToken })
}

function cosCall(client, method, params) {
  return new Promise((resolve, reject) => {
    client[method](params, (error, data) => error ? reject(error) : resolve(data))
  })
}

function responseHeader(response, name) {
  const wanted = name.toLowerCase()
  const headers = response && response.headers && typeof response.headers === 'object'
    ? response.headers
    : {}
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted)
      return Array.isArray(value) ? value[0] : value
  }
  for (const [key, value] of Object.entries(response || {})) {
    if (key.toLowerCase() === wanted)
      return Array.isArray(value) ? value[0] : value
  }
  return undefined
}

function documentRecord(response) {
  return response && Array.isArray(response.data) ? response.data[0] : undefined
}

function catalogDocumentId(ownerId, projectId, assetId) {
  return crypto.createHash('sha256').update(`${ownerId}\0${projectId}\0${assetId}`).digest('hex')
}

function encodedCopySource(key) {
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `${BUCKET}.cos.${REGION}.myqcloud.com/${encodedKey}`
}

async function reserveUpload(event, ownerId, cos) {
  const request = normalizeUploadRequest(event)
  const hardLimit = Number(process.env.ADVJS_ASSET_MAX_BYTES || Number.MAX_SAFE_INTEGER)
  const limit = Math.min(MAX_BYTES[request.type], Number.isFinite(hardLimit) ? hardLimit : Number.MAX_SAFE_INTEGER)
  if (request.bytes > limit)
    throw new Error(`${request.type} assets may not exceed ${limit} bytes`)

  const pending = await uploads.where({ ownerId, status: 'pending' }).count()
  if (Number(pending.total || 0) >= MAX_PENDING_UPLOADS)
    throw new Error('too many pending uploads; complete or wait for existing reservations')

  const uploadId = crypto.randomUUID()
  const objectKey = buildStagingObjectKey(ownerId, uploadId, request.fileName)
  const now = Date.now()
  const expiresAt = now + RESERVATION_SECONDS * 1000
  const headers = {
    'Content-Type': request.mimeType,
    'x-cos-meta-advjs-upload-id': uploadId,
    'x-cos-meta-sha256': request.sha256,
  }

  await uploads.doc(uploadId).set({
    uploadId,
    ownerId,
    status: 'pending',
    stagingObjectKey: objectKey,
    ...request,
    createdAt: now,
    expiresAt,
  })

  try {
    const signed = await cosCall(cos, 'getObjectUrl', {
      Bucket: BUCKET,
      Region: REGION,
      Key: objectKey,
      Method: 'PUT',
      Expires: RESERVATION_SECONDS,
      Headers: headers,
      Sign: true,
    })
    const putUrl = signed && (signed.Url || signed.url)
    if (!putUrl)
      throw new Error('COS did not return a signed upload URL')
    return { ok: true, uploadId, objectKey, putUrl, headers, expiresAt }
  }
  catch (error) {
    await uploads.doc(uploadId).update({ status: 'failed', failure: 'signing_failed', updatedAt: Date.now() })
    throw error
  }
}

function verifyUploadedObject(head, record, uploadId) {
  const bytes = Number(responseHeader(head, 'content-length'))
  const mimeType = String(responseHeader(head, 'content-type') || '').split(';')[0].trim().toLowerCase()
  const sha256 = String(responseHeader(head, 'x-cos-meta-sha256') || '').toLowerCase()
  const signedUploadId = String(responseHeader(head, 'x-cos-meta-advjs-upload-id') || '')
  if (bytes !== record.bytes)
    throw new Error(`uploaded byte length mismatch: expected ${record.bytes}, received ${bytes}`)
  if (mimeType !== record.mimeType)
    throw new Error(`uploaded content type mismatch: expected ${record.mimeType}, received ${mimeType || 'missing'}`)
  if (sha256 !== record.sha256)
    throw new Error('uploaded SHA-256 metadata does not match the reservation')
  if (signedUploadId !== uploadId)
    throw new Error('uploaded reservation metadata does not match')
}

async function verifyObjectContentHash(cos, objectKey, record) {
  const hash = crypto.createHash('sha256')
  let received = 0
  while (received < record.bytes) {
    const end = Math.min(received + HASH_CHUNK_BYTES, record.bytes) - 1
    const response = await cosCall(cos, 'getObject', {
      Bucket: BUCKET,
      Region: REGION,
      Key: objectKey,
      Range: `bytes=${received}-${end}`,
    })
    const body = response && response.Body
    if (!body)
      throw new Error('COS returned an empty body during SHA-256 verification')
    const chunk = Buffer.isBuffer(body) ? body : Buffer.from(body)
    if (chunk.length !== end - received + 1)
      throw new Error('COS returned an unexpected range during SHA-256 verification')
    hash.update(chunk)
    received += chunk.length
  }
  if (hash.digest('hex') !== record.sha256)
    throw new Error('uploaded content SHA-256 does not match the reservation')
}

async function completeUpload(event, ownerId, cos) {
  const uploadId = typeof event.uploadId === 'string' ? event.uploadId : ''
  const sha256 = typeof event.sha256 === 'string' ? event.sha256.toLowerCase() : ''
  if (!uploadId)
    throw new Error('uploadId is required')

  const found = await uploads.doc(uploadId).get()
  const record = documentRecord(found)
  if (!record || record.ownerId !== ownerId)
    throw new Error('upload reservation was not found')
  if (record.status === 'complete') {
    const existing = await assets.doc(record.catalogDocumentId).get()
    const existingRecord = documentRecord(existing)
    if (existingRecord)
      return { ok: true, asset: publicAssetRecord(existingRecord) }
  }
  if (record.status !== 'pending')
    throw new Error(`upload reservation is ${record.status}`)
  if (record.expiresAt <= Date.now())
    throw new Error('upload reservation expired')
  if (sha256 !== record.sha256)
    throw new Error('completion SHA-256 does not match the reservation')

  const head = await cosCall(cos, 'headObject', {
    Bucket: BUCKET,
    Region: REGION,
    Key: record.stagingObjectKey,
  })
  verifyUploadedObject(head, record, uploadId)
  await verifyObjectContentHash(cos, record.stagingObjectKey, record)

  const objectKey = buildFinalObjectKey(ownerId, record)
  await cosCall(cos, 'putObjectCopy', {
    Bucket: BUCKET,
    Region: REGION,
    Key: objectKey,
    CopySource: encodedCopySource(record.stagingObjectKey),
  })
  const finalHead = await cosCall(cos, 'headObject', { Bucket: BUCKET, Region: REGION, Key: objectKey })
  verifyUploadedObject(finalHead, record, uploadId)

  const now = Date.now()
  const catalogId = catalogDocumentId(ownerId, record.projectId, record.assetId)
  const catalogRecord = {
    ownerId,
    projectId: record.projectId,
    assetId: record.assetId,
    kind: record.kind,
    type: record.type,
    fileName: record.fileName,
    sha256: record.sha256,
    bytes: record.bytes,
    mimeType: record.mimeType,
    bucket: BUCKET,
    region: REGION,
    objectKey,
    status: 'complete',
    createdAt: now,
    updatedAt: now,
  }
  await assets.doc(catalogId).set(catalogRecord)
  await uploads.doc(uploadId).update({ status: 'complete', catalogDocumentId: catalogId, completedAt: now })

  try {
    await cosCall(cos, 'deleteObject', { Bucket: BUCKET, Region: REGION, Key: record.stagingObjectKey })
  }
  catch (error) {
    console.warn('[advjsAssets] staging cleanup failed:', error && error.message)
  }

  return { ok: true, asset: publicAssetRecord(catalogRecord) }
}

async function listAssets(event, ownerId) {
  const projectId = typeof event.projectId === 'string' ? event.projectId : ''
  if (!projectId)
    throw new Error('projectId is required')
  const result = await assets.where({ ownerId, projectId, status: 'complete' }).limit(1000).get()
  return {
    ok: true,
    assets: (result.data || []).map(publicAssetRecord),
  }
}

async function getPreviewUrl(event, ownerId, cos) {
  const projectId = typeof event.projectId === 'string' ? event.projectId : ''
  const assetId = typeof event.assetId === 'string' ? event.assetId : ''
  if (!projectId || !assetId)
    throw new Error('projectId and assetId are required')
  const id = catalogDocumentId(ownerId, projectId, assetId)
  const record = documentRecord(await assets.doc(id).get())
  if (!record || record.ownerId !== ownerId || record.status !== 'complete')
    throw new Error('asset was not found')
  const signed = await cosCall(cos, 'getObjectUrl', {
    Bucket: BUCKET,
    Region: REGION,
    Key: record.objectKey,
    Method: 'GET',
    Expires: PREVIEW_SECONDS,
    Sign: true,
  })
  return {
    ok: true,
    asset: publicAssetRecord(record),
    url: signed.Url || signed.url,
    expiresAt: Date.now() + PREVIEW_SECONDS * 1000,
  }
}

exports.main = async (event, context) => {
  const payload = event || {}
  const ownerId = resolveUid(context)
  if (!ownerId)
    return fail('Login required')

  try {
    if (payload.action === 'health')
      return { ok: true, provider: 'tencent-cos', region: REGION, managed: true }
    if (payload.action === 'listAssets')
      return await listAssets(payload, ownerId)

    const cos = createCosClient()
    switch (payload.action) {
      case 'reserveUpload':
        return await reserveUpload(payload, ownerId, cos)
      case 'completeUpload':
        return await completeUpload(payload, ownerId, cos)
      case 'getPreviewUrl':
        return await getPreviewUrl(payload, ownerId, cos)
      default:
        return fail(`Unknown action: ${String(payload.action)}`)
    }
  }
  catch (error) {
    console.error('[advjsAssets] request failed:', error)
    return fail(error && error.message ? error.message : 'Internal error')
  }
}
