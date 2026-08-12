/**
 * Pure unit test for classifySyncCandidates — the conflict-detection core
 * of useCloudSync.performSync. Covers the 4 decisions × baseline-set vs
 * baseline-missing matrix.
 */
import type cloudbase from '@cloudbase/js-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  classifySyncCandidates,
  collectProjectFilesForSync,
  configureManagedCloudSync,
  downloadBlobFromCloud,
  uploadToCloud,
} from '../utils/cloudSync'

const T0 = 1_700_000_000_000 // arbitrary baseline ms
const T_BEFORE = T0 - 60_000
const T_AFTER = T0 + 60_000

function maps(local: Record<string, number>, cloud: Record<string, number>) {
  return {
    localPaths: new Map(Object.entries(local)),
    cloudPaths: new Map(Object.entries(cloud)),
  }
}

describe('classifySyncCandidates · baseline set', () => {
  it('files only on local → upload', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_AFTER }, {}),
      baselineMs: T0,
    })
    expect(out).toEqual([{ path: 'a.md', decision: 'upload', localMtime: T_AFTER }])
  })

  it('files only on cloud → download', () => {
    const out = classifySyncCandidates({
      ...maps({}, { 'b.md': T_AFTER }),
      baselineMs: T0,
    })
    expect(out).toEqual([{ path: 'b.md', decision: 'download', cloudMtime: T_AFTER }])
  })

  it('only local changed since baseline → upload', () => {
    const out = classifySyncCandidates({
      ...maps({ 'c.md': T_AFTER }, { 'c.md': T_BEFORE }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'c.md', decision: 'upload' })
  })

  it('only cloud changed since baseline → download', () => {
    const out = classifySyncCandidates({
      ...maps({ 'd.md': T_BEFORE }, { 'd.md': T_AFTER }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'd.md', decision: 'download' })
  })

  it('both sides changed since baseline → conflict', () => {
    const out = classifySyncCandidates({
      ...maps({ 'e.md': T_AFTER + 1000 }, { 'e.md': T_AFTER + 2000 }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'e.md', decision: 'conflict' })
    expect(out[0].localMtime).toBe(T_AFTER + 1000)
    expect(out[0].cloudMtime).toBe(T_AFTER + 2000)
  })

  it('neither side changed since baseline → noop', () => {
    const out = classifySyncCandidates({
      ...maps({ 'f.md': T_BEFORE }, { 'f.md': T_BEFORE }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'f.md', decision: 'noop' })
  })

  it('mixed batch produces deterministic decisions per file', () => {
    const out = classifySyncCandidates({
      ...maps(
        { 'up.md': T_AFTER, 'noop.md': T_BEFORE, 'conflict.md': T_AFTER },
        { 'noop.md': T_BEFORE, 'conflict.md': T_AFTER + 100, 'down.md': T_AFTER },
      ),
      baselineMs: T0,
    })
    const byPath = Object.fromEntries(out.map(c => [c.path, c.decision]))
    expect(byPath).toEqual({
      'up.md': 'upload',
      'noop.md': 'noop',
      'conflict.md': 'conflict',
      'down.md': 'download',
    })
  })
})

describe('classifySyncCandidates · baseline missing (first-time sync)', () => {
  it('falls back to newer-wins (local newer → upload)', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_AFTER }, { 'a.md': T_BEFORE }),
      baselineMs: undefined,
    })
    expect(out[0]).toMatchObject({ path: 'a.md', decision: 'upload' })
  })

  it('falls back to newer-wins (cloud newer → download)', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_BEFORE }, { 'a.md': T_AFTER }),
      baselineMs: undefined,
    })
    expect(out[0]).toMatchObject({ path: 'a.md', decision: 'download' })
  })

  it('equal mtimes → noop, never conflict (no baseline available)', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_AFTER }, { 'a.md': T_AFTER }),
      baselineMs: undefined,
    })
    expect(out[0]).toMatchObject({ path: 'a.md', decision: 'noop' })
  })
})

describe('managed asset upload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses an authenticated function reservation and never browser COS credentials', async () => {
    const calls: Array<Record<string, unknown>> = []
    const app = {
      async callFunction(input: { data: Record<string, unknown> }) {
        calls.push(input.data)
        if (input.data.action === 'reserveUpload') {
          return {
            result: {
              ok: true,
              upload: {
                expiresAt: '2026-07-20T12:00:00.000Z',
                headers: { 'content-type': 'image/png' },
                uploadId: 'upl_1',
                url: 'https://signed.example/upload',
              },
            },
          }
        }
        return { result: { ok: true } }
      },
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    configureManagedCloudSync(app as unknown as cloudbase.app.App)

    await uploadToCloud(
      { bucket: 'managed', region: 'ap-shanghai' },
      'adv-projects/demo/images/cover.png',
      new Blob(['png'], { type: 'image/png' }),
    )

    expect(calls).toEqual([
      {
        action: 'reserveUpload',
        bytes: 3,
        contentType: 'image/png',
        key: 'adv-projects/demo/images/cover.png',
      },
      { action: 'finalizeUpload', uploadId: 'upl_1' },
    ])
    expect(fetchMock).toHaveBeenCalledWith('https://signed.example/upload', expect.objectContaining({
      headers: { 'content-type': 'image/png' },
      method: 'PUT',
    }))
  })

  it('collects text and binary files for subsequent project syncs', async () => {
    const blobs = new Map([
      ['README.md', new Blob(['readme'], { type: 'text/markdown' })],
      ['assets/cover.png', new Blob(['png'], { type: 'image/png' })],
    ])
    const fs = {
      async readBlob(path: string) {
        return blobs.get(path)!
      },
      async readdir(path: string) {
        if (!path) {
          return [
            { mtime: 10, name: 'README.md', path: 'README.md', size: 6, type: 'file' as const },
            { mtime: 0, name: 'assets', path: 'assets', size: 0, type: 'directory' as const },
            { mtime: 0, name: 'node_modules', path: 'node_modules', size: 0, type: 'directory' as const },
          ]
        }
        if (path === 'assets')
          return [{ mtime: 20, name: 'cover.png', path: 'assets/cover.png', size: 3, type: 'file' as const }]
        throw new Error(`Unexpected path: ${path}`)
      },
    }

    const files = await collectProjectFilesForSync(fs)

    expect(files.map(file => [file.path, file.content.type, file.lastModified.getTime()])).toEqual([
      ['README.md', 'text/markdown', 10],
      ['assets/cover.png', 'image/png', 20],
    ])
  })

  it('downloads binary previews without decoding them as text', async () => {
    const app = {
      async callFunction() {
        return {
          result: {
            ok: true,
            preview: {
              expiresAt: '2026-07-20T12:00:00.000Z',
              url: 'https://signed.example/cover.png',
            },
          },
        }
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('png', {
      headers: { 'content-type': 'image/png' },
    })))
    configureManagedCloudSync(app as unknown as cloudbase.app.App)

    const blob = await downloadBlobFromCloud(
      { bucket: 'managed', region: 'ap-shanghai' },
      'adv-projects/demo/assets/cover.png',
    )

    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('png')
  })
})
