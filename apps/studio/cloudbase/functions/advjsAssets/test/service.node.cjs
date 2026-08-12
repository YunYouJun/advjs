// Keep this suite on Node's native test runner; the CloudBase function is CommonJS.
const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { createAssetService } = require('../service')

function fixture(overrides = {}) {
  const calls = []
  const uploads = new Map()
  const assets = new Map()
  const repository = {
    async cancelUpload(input) {
      calls.push(['cancelUpload', input])
    },
    async commitUpload(input) {
      calls.push(['commitUpload', input])
      const asset = {
        _id: input.assetId,
        ownerId: input.ownerId,
        privateKey: input.privateKey,
        projectId: input.projectId,
        referenceCount: 0,
        relativePath: input.relativePath,
        status: 'ready',
        ...input.object,
      }
      assets.set(asset._id, asset)
      return asset
    },
    async createUpload(input) {
      calls.push(['createUpload', input])
      uploads.set(input.id, input)
      return input
    },
    async getAssetById(ownerId, assetId) {
      const asset = assets.get(assetId)
      return asset?.ownerId === ownerId ? asset : undefined
    },
    async getAssetByPath() {
      return undefined
    },
    async getUpload(ownerId, uploadId) {
      const upload = uploads.get(uploadId)
      return upload?.ownerId === ownerId ? upload : undefined
    },
    async listAssets() {
      return [...assets.values()]
    },
    async deleteAsset(input) {
      calls.push(['deleteAsset', input])
      assets.delete(input.assetId)
    },
    ...overrides.repository,
  }
  const storage = {
    async createUploadGrant(input) {
      calls.push(['createUploadGrant', input])
      return {
        expiresAt: '2026-07-20T00:15:00.000Z',
        headers: { 'content-type': input.contentType },
        stagingKey: `staging/${input.ownerId}/${input.uploadId}/source`,
        url: 'https://upload.example.test/exact-object?signature=short-lived',
      }
    },
    async cleanupStaging(input) {
      calls.push(['cleanupStaging', input])
    },
    async finalize(input) {
      calls.push(['finalize', input])
      return {
        bytes: 42,
        contentType: 'image/webp',
        etag: 'etag-hero',
        privateKey: `private/accounts/${input.ownerId}/projects/${input.projectId}/assets/${input.assetId}/hero.webp`,
        sha256: 'a'.repeat(64),
        versionId: 'version-1',
      }
    },
    async preview(input) {
      calls.push(['preview', input])
      return {
        expiresAt: '2026-07-20T00:05:00.000Z',
        url: 'https://preview.example.test/hero.webp?signature=short-lived',
      }
    },
    async health() {
      calls.push(['health'])
      return { bucket: 'managed', region: 'ap-shanghai' }
    },
    async deletePrivate(input) {
      calls.push(['deletePrivate', input])
    },
    ...overrides.storage,
  }
  return {
    calls,
    repository,
    service: createAssetService({
      clock: () => new Date('2026-07-20T00:00:00.000Z'),
      defaultQuotaBytes: 1024,
      drivePreviewToken: 'server-only-token',
      id: prefix => `${prefix}_1`,
      repository,
      storage,
    }),
  }
}

describe('advjs asset service', () => {
  it('reserves an exact owner and game scoped upload capability', async () => {
    const { calls, service } = fixture()

    const result = await service.reserveUpload('owner', {
      bytes: 42,
      contentType: 'image/webp',
      key: 'adv-projects/hamster/assets/hero.webp',
    })

    assert.equal(result.uploadId, 'upl_1')
    assert.equal(result.projectId, 'hamster')
    assert.equal(result.relativePath, 'assets/hero.webp')
    assert.match(result.url, /^https:\/\/upload\.example\.test\//)
    assert.deepEqual(calls.map(([name]) => name), ['createUpload', 'createUploadGrant'])
    assert.equal(calls[0][1].ownerId, 'owner')
    assert.equal(calls[0][1].reservedBytes, 42)
  })

  it('accepts a file directly below the game root', async () => {
    const { service } = fixture()

    const result = await service.reserveUpload('owner', {
      bytes: 12,
      contentType: 'text/markdown; charset=utf-8',
      key: 'adv-projects/hamster/README.md',
    })

    assert.equal(result.projectId, 'hamster')
    assert.equal(result.relativePath, 'README.md')
  })

  it('accepts empty project files without weakening path isolation', async () => {
    const { service } = fixture()

    const result = await service.reserveUpload('owner', {
      bytes: 0,
      contentType: 'text/plain',
      key: 'adv-projects/hamster/empty.txt',
    })

    assert.equal(result.relativePath, 'empty.txt')
    await assert.rejects(() => service.reserveUpload('../owner', {
      bytes: 1,
      contentType: 'text/plain',
      key: 'adv-projects/hamster/readme.txt',
    }), { code: 'UNAUTHENTICATED' })
    await assert.rejects(() => service.reserveUpload('owner', {
      bytes: 1,
      contentType: 'text/plain',
      key: 'adv-projects/hamster/assets\\escape.txt',
    }), { code: 'INVALID_INPUT' })
  })

  it('finalizes only the caller upload and commits verified object metadata', async () => {
    const { calls, service } = fixture()
    await service.reserveUpload('owner', {
      bytes: 42,
      contentType: 'image/webp',
      key: 'adv-projects/hamster/assets/hero.webp',
    })

    await assert.rejects(() => service.finalizeUpload('other', 'upl_1'), { code: 'NOT_FOUND' })
    const asset = await service.finalizeUpload('owner', 'upl_1')

    assert.equal(asset.sha256, 'a'.repeat(64))
    assert.equal(asset.status, 'ready')
    assert.equal(asset.versionId, 'version-1')
    assert.deepEqual(calls.map(([name]) => name), ['createUpload', 'createUploadGrant', 'finalize', 'commitUpload', 'cleanupStaging'])
  })

  it('requires the server token and exact owner before signing a Drive preview', async () => {
    const { calls, repository, service } = fixture()
    repository.getAssetById = async (ownerId, assetId) => assetId === 'asset_hero' && ownerId === 'owner'
      ? { _id: assetId, contentType: 'image/webp', ownerId, privateKey: 'private/opaque', status: 'ready', versionId: 'version-1' }
      : undefined

    await assert.rejects(() => service.createDrivePreview({ assetId: 'asset_hero', ownerId: 'owner', serviceToken: 'wrong' }), { code: 'FORBIDDEN' })
    await assert.rejects(() => service.createDrivePreview({ assetId: 'asset_hero', ownerId: 'other', serviceToken: 'server-only-token' }), { code: 'NOT_FOUND' })
    const preview = await service.createDrivePreview({ assetId: 'asset_hero', ownerId: 'owner', serviceToken: 'server-only-token' })

    assert.equal(preview.kind, 'image')
    assert.equal(preview.status, 'ready')
    assert.equal(calls.at(-1)[1].versionId, 'version-1')
  })

  it('proves the server-only storage identity without exposing credentials', async () => {
    const { calls, service } = fixture()

    await assert.rejects(() => service.serviceHealth({ serviceToken: 'wrong' }), { code: 'FORBIDDEN' })
    const result = await service.serviceHealth({ serviceToken: 'server-only-token' })

    assert.deepEqual(result, { bucket: 'managed', region: 'ap-shanghai' })
    assert.equal(calls.at(-1)[0], 'health')
  })

  it('never deletes referenced or published assets and removes only private source bytes', async () => {
    const { calls, repository, service } = fixture()
    repository.getAssetByPath = async () => ({
      _id: 'asset_hero',
      ownerId: 'owner',
      privateKey: 'private/opaque',
      published: false,
      referenceCount: 1,
      status: 'ready',
    })
    await assert.rejects(() => service.deleteAsset('owner', 'adv-projects/hamster/assets/hero.webp'), { code: 'ASSET_IN_USE' })

    repository.getAssetByPath = async () => ({
      _id: 'asset_hero',
      ownerId: 'owner',
      privateKey: 'private/opaque',
      published: true,
      referenceCount: 0,
      status: 'ready',
    })
    await assert.rejects(() => service.deleteAsset('owner', 'adv-projects/hamster/assets/hero.webp'), { code: 'INVALID_STATE' })

    repository.getAssetByPath = async () => ({
      _id: 'asset_hero',
      bytes: 42,
      ownerId: 'owner',
      privateKey: 'private/opaque',
      published: false,
      referenceCount: 0,
      status: 'ready',
    })
    await service.deleteAsset('owner', 'adv-projects/hamster/assets/hero.webp')
    assert.deepEqual(calls.slice(-2).map(([name]) => name), ['deletePrivate', 'deleteAsset'])
  })
})
