import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildFinalObjectKey,
  buildStagingObjectKey,
  normalizeUploadRequest,
  publicAssetRecord,
} = require('../../cloudbase/functions/advjsAssets/contract.js')

describe('advjsAssets cloud contract', () => {
  const valid = {
    projectId: 'hamster-demo',
    assetId: 'character/observer/curious',
    fileName: 'curious.png',
    kind: 'tachie',
    type: 'image',
    bytes: 4096,
    mimeType: 'image/png',
    sha256: 'a'.repeat(64),
  }

  it('creates account-isolated staging and content-addressed final keys', () => {
    const request = normalizeUploadRequest(valid)

    expect(buildStagingObjectKey('user-42', 'upload-7', request.fileName)).toBe(
      'staging/accounts/user-42/uploads/upload-7/curious.png',
    )
    expect(buildFinalObjectKey('user-42', request)).toBe(
      `private/accounts/user-42/projects/hamster-demo/assets/character/observer/curious/${'a'.repeat(64)}.png`,
    )
  })

  it.each([
    ['project traversal', { ...valid, projectId: '../other' }],
    ['asset traversal', { ...valid, assetId: 'cg/../../secret' }],
    ['nested filename', { ...valid, fileName: '../secret.png' }],
    ['invalid hash', { ...valid, sha256: 'abc' }],
    ['mismatched media type', { ...valid, type: 'audio', mimeType: 'image/png' }],
  ])('rejects %s', (_label, input) => {
    expect(() => normalizeUploadRequest(input)).toThrow(/ADV_ASSET_UPLOAD_INVALID/u)
  })

  it('does not expose private COS coordinates in public catalog records', () => {
    const request = normalizeUploadRequest(valid)
    const record = publicAssetRecord({
      ...request,
      ownerId: 'user-42',
      objectKey: 'private/accounts/user-42/projects/hamster-demo/secret.png',
      bucket: 'private-bucket',
      region: 'ap-shanghai',
      createdAt: 1,
      updatedAt: 2,
    })

    expect(record).toEqual(expect.objectContaining({
      id: valid.assetId,
      kind: valid.kind,
      type: valid.type,
      bytes: valid.bytes,
      sha256: valid.sha256,
    }))
    expect(record).not.toHaveProperty('objectKey')
    expect(record).not.toHaveProperty('bucket')
    expect(record).not.toHaveProperty('ownerId')
  })
})
