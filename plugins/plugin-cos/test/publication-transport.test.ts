// @vitest-environment node
import { Buffer } from 'node:buffer'
import COS from 'cos-nodejs-sdk-v5'
import { describe, expect, it } from 'vitest'
import { createCosHttpFixture } from '../../../tests/fixtures/audio/cos-http'
import { CosStorage } from '../src'

describe('cOS immutable publication SDK transport', () => {
  it('uses server-side STS authorization callbacks scoped to actual object requests over real HTTP', async () => {
    const cos = await createCosHttpFixture()
    try {
      const authorizations: Array<{ key: string, method: string }> = []
      const client = new COS({
        Protocol: 'http:',
        Domain: new URL(cos.url).host,
        FollowRedirect: false,
        Timeout: 5_000,
        getAuthorization(options, callback) {
          authorizations.push({ key: options.Key, method: options.Method })
          const now = Math.floor(Date.now() / 1000)
          callback({ TmpSecretId: 'test-only-sts', TmpSecretKey: 'test-only-sts-key', SecurityToken: `test-only-token-${authorizations.length}`, StartTime: now - 10, ExpiredTime: now + 3600, ScopeLimit: true })
        },
      })
      const storage = new CosStorage({ client, bucket: 'test-only-1234567890', region: 'ap-test', prefix: '' })
      const keys = ['project/first.01234567.webm', 'project/second.01234567.webm']
      for (const key of keys)
        await storage.putBytes(key, Buffer.from('actual-STS-SDK-transport'))
      expect(authorizations).toEqual(keys.map(key => ({ key, method: 'PUT' })))
      const puts = cos.requests.filter(request => request.method === 'PUT')
      expect(puts.map(request => request.headers['x-cos-security-token'])).toEqual(['test-only-token-1', 'test-only-token-2'])
      expect(puts.every(request => !Object.hasOwn(request.headers, 'secretkey'))).toBe(true)
      expect(puts.every(request => !Object.hasOwn(request.headers, 'tmpsecretkey'))).toBe(true)
    }
    finally { await cos.close() }
  })

  it('uses real HTTP with forbid-overwrite, metadata and ETag-pinned bounded reads', async () => {
    const cos = await createCosHttpFixture()
    try {
      const bytes = Buffer.from('real-sdk-test')
      await cos.storage.putBytes('project/audio/test.aabbccdd.webm', bytes, { forbidOverwrite: true, metadata: { sha256: 'test-sha' } })
      const info = await cos.storage.head('project/audio/test.aabbccdd.webm')
      expect(info).toMatchObject({ contentLength: bytes.length, contentType: 'audio/webm', cacheControl: 'public, max-age=31536000, immutable', metadata: { sha256: 'test-sha' } })
      expect(await cos.storage.readBytes('project/audio/test.aabbccdd.webm', bytes.length, { ifMatch: info!.etag })).toEqual(bytes)
      await expect(cos.storage.putBytes('project/audio/test.aabbccdd.webm', Buffer.from('changed'), { forbidOverwrite: true })).rejects.toMatchObject({ statusCode: 409 })
      await expect(cos.storage.readBytes('project/audio/test.aabbccdd.webm', bytes.length, { ifMatch: 'changed-etag' })).rejects.toMatchObject({ statusCode: 412 })
      expect(cos.requests.find(request => request.method === 'PUT')!.headers['x-cos-forbid-overwrite']).toBe('true')
      expect(await cos.storage.head('missing.webm')).toBeNull()
      await expect(cos.storage.readBytes('project/audio/test.aabbccdd.webm', bytes.length - 1)).rejects.toBeDefined()
    }
    finally { await cos.close() }
  })
  it.each(['Enabled', 'Suspended'] as const)('rejects %s versioning before an immutable upload', async (versioning) => {
    const cos = await createCosHttpFixture(versioning)
    try {
      await expect(cos.storage.putBytes('project/file.aabbccdd.webm', Buffer.from('test'), { forbidOverwrite: true })).rejects.toThrow('IMMUTABLE_BUCKET_REQUIRED')
      expect(cos.requests.some(request => request.method === 'PUT')).toBe(false)
    }
    finally { await cos.close() }
  })
})
