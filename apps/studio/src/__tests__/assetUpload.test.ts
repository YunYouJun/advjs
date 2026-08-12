import { describe, expect, it, vi } from 'vitest'
import { createManagedAssetUploader } from '../utils/assetUpload'

describe('managed Studio asset upload', () => {
  it('reserves one object, uploads it, and completes the verified catalog record', async () => {
    const callFunction = vi.fn()
      .mockResolvedValueOnce({
        result: {
          ok: true,
          uploadId: 'upload-1',
          objectKey: 'staging/accounts/user/uploads/upload-1/source',
          putUrl: 'https://bucket.example.com/staging/source?signature=short-lived',
          headers: { 'Content-Type': 'text/plain' },
          expiresAt: Date.now() + 60_000,
        },
      })
      .mockResolvedValueOnce({
        result: {
          ok: true,
          asset: {
            id: 'data/hello',
            kind: 'data',
            type: 'data',
            objectKey: 'private/accounts/user/projects/demo/assets/data-hello/hello.txt',
            sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
            bytes: 5,
          },
        },
      })
    const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const uploader = createManagedAssetUploader({ callFunction }, { fetcher: put })

    const result = await uploader.upload({
      projectId: 'demo',
      assetId: 'data/hello',
      fileName: 'hello.txt',
      file: new Blob(['hello'], { type: 'text/plain' }),
      kind: 'data',
      type: 'data',
    })

    expect(callFunction).toHaveBeenNthCalledWith(1, {
      name: 'advjsAssets',
      data: expect.objectContaining({
        action: 'reserveUpload',
        projectId: 'demo',
        assetId: 'data/hello',
        bytes: 5,
        mimeType: 'text/plain',
        sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      }),
    })
    expect(put).toHaveBeenCalledWith(
      expect.stringContaining('signature=short-lived'),
      expect.objectContaining({ method: 'PUT', body: expect.any(Blob) }),
    )
    expect(callFunction).toHaveBeenNthCalledWith(2, {
      name: 'advjsAssets',
      data: {
        action: 'completeUpload',
        uploadId: 'upload-1',
        sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      },
    })
    expect(result.id).toBe('data/hello')
  })
})
