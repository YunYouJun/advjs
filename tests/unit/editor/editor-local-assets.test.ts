// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalBridgeAdapter } from '../../../editor/core/app/adapters/local'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('editor local asset preview', () => {
  it('resolves only runtime audio and its variants through authenticated media reads, preserving identity and preview URL ownership', async () => {
    let sequence = 0
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => `blob:audio-${++sequence}`),
      revokeObjectURL: vi.fn(),
    }))
    const requests: string[] = []
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer fixture-only' })
      const path = new URL(String(input)).searchParams.get('path')!
      requests.push(path)
      return new Response(new Blob([path], { type: path.endsWith('.m4a') ? 'audio/mp4' : 'audio/wav' }))
    })
    const adapter = createLocalBridgeAdapter({ origin: 'http://127.0.0.1:3000', token: 'fixture-only', fetch: fetcher as typeof fetch })
    const sha256 = 'a'.repeat(64)
    const compilation = { project: {
      scenes: [],
      assets: { schemaVersion: 2, id: 'audio', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [
        { id: 'voice/selected', type: 'audio', kind: 'voice', path: 'voice/selected.wav', sha256, bytes: 100, mimeType: 'audio/wav', duration: 1, variants: { aac: { path: 'voice/selected.m4a', sha256: 'b'.repeat(64), bytes: 50, mimeType: 'audio/mp4' } } },
        { id: 'voice/history', type: 'audio', kind: 'voice', path: 'voice/history.wav' },
        { id: 'voice/reference', type: 'audio', kind: 'reference', path: 'voice/reference.wav' },
      ] },
    } } as any
    const selectedTake = { lines: { line: { locales: { 'zh-CN': { selectedTake: 'take-selected' } } } } }
    const input = { characters: [], scenes: [], audio: { assets: { 'voice/selected': { src: 'public/media/voice/selected.wav', kind: 'voice', sha256, duration: 1 } }, voiceLedger: selectedTake } } as any
    const authorUrl = await adapter.readAssetBlobUrl('voice/reference.wav')
    const preview = await adapter.resolvePreviewConfig(compilation, input)
    expect(preview.audio?.assets['voice/selected']).toMatchObject({ src: 'blob:audio-3', kind: 'voice', sha256, bytes: 100, mime: 'audio/wav', duration: 1, variants: { aac: { src: 'blob:audio-2', sha256: 'b'.repeat(64), mime: 'audio/mp4' } } })
    expect(preview.audio?.voiceLedger).toBe(selectedTake)
    expect(Object.keys(preview.audio!.assets)).toEqual(['voice/selected'])
    expect(requests).toEqual(['voice/reference.wav', 'public/media/voice/selected.m4a', 'public/media/voice/selected.wav'])
    expect(input.audio.assets['voice/selected'].src).toBe('public/media/voice/selected.wav')
    await adapter.resolvePreviewConfig(compilation, input)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-2')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-3')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(authorUrl)
    adapter.dispose()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(authorUrl)
  })

  it('does not allocate a late audio URL after a new preview supersedes its authenticated load', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:current-audio'), revokeObjectURL: vi.fn() }))
    let finishOld!: (response: Response) => void
    const adapter = createLocalBridgeAdapter({ origin: 'http://127.0.0.1:3000', token: 'fixture-only', fetch: vi.fn(async (input: string | URL) => String(input).includes('old.wav')
      ? await new Promise<Response>(resolve => finishOld = resolve)
      : new Response(new Blob(['current'], { type: 'audio/wav' }))) as typeof fetch })
    const compilation = { project: { scenes: [], assets: { schemaVersion: 2, id: 'audio', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [{ id: 'voice/old', type: 'audio', kind: 'voice', path: 'old.wav' }, { id: 'voice/current', type: 'audio', kind: 'voice', path: 'current.wav' }] } } } as any
    const config = (id: string) => ({ characters: [], scenes: [], audio: { assets: { [id]: { src: `${id}.wav`, kind: 'voice' } } } } as any)
    const old = adapter.resolvePreviewConfig(compilation, config('voice/old'))
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(finishOld).toBeTypeOf('function'))
    const current = await adapter.resolvePreviewConfig(compilation, config('voice/current'))
    finishOld(new Response(new Blob(['late'], { type: 'audio/wav' })))
    await rejected
    expect(current.audio?.assets['voice/current'].src).toBe('blob:current-audio')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    adapter.dispose()
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:current-audio')
  })

  it('resolves scene asset ids through the authenticated local bridge', async () => {
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:asset-1'),
      revokeObjectURL: vi.fn(),
    }))
    const fetcher = vi.fn(async (input: string | URL) => {
      expect(String(input)).toContain('/__advjs/api/asset?path=adv%2Fassets%2Fbackgrounds%2Flibrary.webp')
      return new Response(new Blob(['image'], { type: 'image/webp' }))
    })
    const adapter = createLocalBridgeAdapter({
      origin: 'http://127.0.0.1:3000',
      token: 'test',
      fetch: fetcher as typeof fetch,
    })
    const config = await adapter.resolvePreviewConfig({
      project: {
        assets: {
          schemaVersion: 2,
          id: 'example',
          defaultProfile: 'local',
          profiles: { local: { provider: 'project', root: 'adv/assets' } },
          assets: [{
            id: 'background/library',
            kind: 'background',
            type: 'image',
            path: 'backgrounds/library.webp',
          }],
        },
        scenes: [{ id: 'library', assetId: 'background/library' }],
      },
    } as any, {
      scenes: [{ id: 'library', type: 'image', src: '' }],
    } as any)

    expect(config.scenes[0]).toMatchObject({ id: 'library', src: 'blob:asset-1' })
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('resolves local portraits without a manifest and owns only preview URLs', async () => {
    let sequence = 0
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => `blob:asset-${++sequence}`),
      revokeObjectURL: vi.fn(),
    }))
    const fetcher = vi.fn(async (input: string | URL) => String(input).includes('missing')
      ? new Response('{}', { status: 404 })
      : new Response(new Blob(['image'])))
    const adapter = createLocalBridgeAdapter({ origin: 'http://127.0.0.1:3000', token: 'test', fetch: fetcher as typeof fetch })
    const authorUrl = await adapter.readAssetBlobUrl('art/reference.webp')
    const input = { characters: [{ id: 'hero', name: 'Hero', avatar: 'art/default.webp', avatars: {
      default: { src: 'art/default.webp' },
      missing: { src: 'art/missing.webp' },
      remote: { src: 'https://example.com/portrait.webp' },
    } }], scenes: [] } as any
    const compilation = { project: { scenes: [] } } as any
    const first = await adapter.resolvePreviewConfig(compilation, input)
    expect(first.characters[0].avatar).toBe('blob:asset-2')
    expect(first.characters[0].avatars).toEqual({ default: { src: 'blob:asset-2' }, remote: { src: 'https://example.com/portrait.webp' } })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(input.characters[0].avatar).toBe('art/default.webp')
    await adapter.resolvePreviewConfig(compilation, input)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:asset-2')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(authorUrl)
    adapter.dispose()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(authorUrl)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:asset-3')
  })
  it('does not allocate URLs when disposed during pending preview or author reads', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() }))
    const finish: ((response: Response) => void)[] = []
    const adapter = createLocalBridgeAdapter({ origin: 'http://127.0.0.1:3000', token: 'test', fetch: vi.fn(() => new Promise<Response>(resolve => finish.push(resolve))) as typeof fetch })
    const preview = adapter.resolvePreviewConfig({ project: { scenes: [] } } as any, { characters: [{ id: 'hero', name: 'Hero', avatar: 'hero.webp' }], scenes: [] } as any)
    const author = adapter.readAssetBlobUrl('reference.webp')
    const previewRejected = expect(preview).rejects.toMatchObject({ name: 'AbortError' })
    const authorRejected = expect(author).rejects.toMatchObject({ name: 'AbortError' })
    adapter.dispose()
    for (const resolve of finish)
      resolve(new Response(new Blob(['late'])))
    await Promise.all([previewRejected, authorRejected])
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    await expect(adapter.readAssetBlobUrl('another.webp')).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects superseded previews without allocating or revoking the current preview URLs', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:current'), revokeObjectURL: vi.fn() }))
    let finishOld!: (response: Response) => void
    const fetcher = vi.fn(async (input: string | URL) => String(input).includes('old.webp')
      ? await new Promise<Response>(resolve => finishOld = resolve)
      : new Response(new Blob(['current'])))
    const adapter = createLocalBridgeAdapter({ origin: 'http://127.0.0.1:3000', token: 'test', fetch: fetcher as typeof fetch })
    const compilation = { project: { scenes: [] } } as any
    const config = (avatar: string) => ({ characters: [{ id: 'hero', name: 'Hero', avatar }], scenes: [] } as any)
    const old = adapter.resolvePreviewConfig(compilation, config('old.webp'))
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' })
    const current = await adapter.resolvePreviewConfig(compilation, config('new.webp'))
    finishOld(new Response(new Blob(['late'])))
    await rejected
    expect(current.characters[0].avatar).toBe('blob:current')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    adapter.dispose()
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:current')
  })
})
