import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { computeAgentProjectRevision } from '@advjs/agent'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { inspectCreativeMediaWrite, recoverCreativeMediaWrite } from '../utils/creativeMediaRecovery'
import { runStudioProjectWrite } from '../utils/projectAudio'

beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Blob', NodeBlob)
})
afterAll(() => vi.unstubAllGlobals())
async function fixture(mask = 0) {
  const before = { 'adv.config.json': '{"id":"recovery"}', 'adv/assets.json': '{"includes":[]}', 'adv/scenes/station.md': 'original scene', 'adv/chapters/intro.adv.md': '@lin\nKeep this dialogue.' }
  const changes = [{ path: 'adv/assets.json', expected: before['adv/assets.json'], content: '{"includes":["assets/image.json"]}' }, { path: 'adv/assets/image.json', expected: null, content: '{"assets":[{"id":"station"}]}' }, { path: 'adv/scenes/station.md', expected: before['adv/scenes/station.md'], content: 'reviewed scene binding' }]
  const after = { ...before, ...Object.fromEntries(changes.map(change => [change.path, change.content])) }
  const files: Record<string, string> = { ...before }
  changes.forEach((change, index) => {
    if (mask & 2 ** index)
      files[change.path] = change.content
  })
  const data = new TextEncoder().encode('unit recovery bytes; real image/speech acceptance is in Chromium').buffer
  const media = { bytes: data.byteLength, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0')).join('') }
  const review = { beforeRevision: await computeAgentProjectRevision(before), afterRevision: await computeAgentProjectRevision(after), changes, mediaPath: 'adv/assets/images/recovery.webp' }
  const blobs = new Map<string, Blob>()
  if (mask & 8)
    blobs.set(review.mediaPath, new Blob([data]))
  const fs = {
    exists: async (path: string) => path in files || blobs.has(path),
    readFile: async (path: string) => files[path]!,
    readBlob: async (path: string) => blobs.get(path)!,
    collectAllFiles: vi.fn(async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) }))),
    writeFile: vi.fn(async (path: string, content: string) => { files[path] = content }),
    writeBlob: vi.fn(async (path: string, blob: Blob) => { blobs.set(path, blob) }),
    deleteFile: vi.fn(async (path: string) => { delete files[path] }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  return { before, after, files, blobs, fs, review, media, data, projectId: 'recovery', mimeType: 'image/webp', acceptsPath: (path: string) => path.startsWith('adv/'), assertCurrent: () => {} }
}

describe('shared image and voice partial-write recovery', () => {
  it('classifies all 16 durable subsets without writing and finishes only reviewed bytes', async () => {
    for (let mask = 0; mask < 16; mask++) {
      const f = await fixture(mask)
      const state = await inspectCreativeMediaWrite(f.fs, f.projectId, f.review, f.media, f.assertCurrent)
      expect(state, `mask ${mask}`).toBe(mask % 8 === 0 ? 'before' : mask === 15 ? 'after' : 'partial')
      expect(f.fs.writeFile).not.toHaveBeenCalled()
      expect(f.fs.writeBlob).not.toHaveBeenCalled()
      await recoverCreativeMediaWrite({ ...f, destination: 'after' })
      expect(f.files).toEqual(f.after)
      expect(await (f.blobs.get(f.review.mediaPath)!).arrayBuffer()).toEqual(f.data)
    }
  })
  it('restores any partial text subset while retaining reusable original media', async () => {
    for (let mask = 1; mask < 16; mask++) {
      const f = await fixture(mask)
      await recoverCreativeMediaWrite({ ...f, destination: 'before' })
      expect(f.files).toEqual(f.before)
      expect(f.blobs.has(f.review.mediaPath)).toBe(Boolean(mask & 8))
      expect(f.fs.writeBlob).not.toHaveBeenCalled()
    }
  })
  it('refuses author edits in touched or unrelated sources and preserves corrupt media', async () => {
    for (const path of ['adv/scenes/station.md', 'adv/chapters/intro.adv.md']) {
      const f = await fixture(9)
      f.files[path] = 'author changed this file'
      expect(await inspectCreativeMediaWrite(f.fs, f.projectId, f.review, f.media, f.assertCurrent)).toBe('conflict')
      await expect(recoverCreativeMediaWrite({ ...f, destination: 'before' })).rejects.toThrow('CONFLICT')
      expect(f.fs.writeFile).not.toHaveBeenCalled()
    }
    const f = await fixture(9)
    const corrupt = new Blob(['different bytes'])
    f.blobs.set(f.review.mediaPath, corrupt)
    await expect(recoverCreativeMediaWrite({ ...f, destination: 'after' })).rejects.toThrow('CONFLICT')
    expect(f.blobs.get(f.review.mediaPath)).toBe(corrupt)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })
  it('rechecks the partial version after waiting for another project writer', async () => {
    const f = await fixture(9)
    let release!: () => void
    const queued = runStudioProjectWrite(f.fs, () => new Promise<void>((resolve) => {
      release = resolve
    }))
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const recovering = recoverCreativeMediaWrite({ ...f, destination: 'after' })
    await vi.waitFor(() => expect(vi.mocked(f.fs.collectAllFiles).mock.calls.length).toBeGreaterThanOrEqual(2))
    f.files['adv/chapters/intro.adv.md'] = 'author saved while recovery was queued'
    release()
    await queued
    await expect(recovering).rejects.toThrow('CONFLICT')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })
  it('requires retained bytes when missing and refuses a late account/project switch', async () => {
    const f = await fixture(1)
    await expect(recoverCreativeMediaWrite({ ...f, data: undefined, destination: 'after' })).rejects.toThrow('BYTES_REQUIRED')
    await expect(recoverCreativeMediaWrite({ ...f, destination: 'before', assertCurrent: () => {
      throw new Error('scope changed')
    } })).rejects.toThrow('scope changed')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })
})
