// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalBridgeAdapter } from '../../editor/core/app/adapters/local'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('editor local asset preview', () => {
  it('resolves portrait variants, deduplicates the default and tolerates a missing optional image', async () => {
    let nextUrl = 0
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => `blob:portrait-${++nextUrl}`), revokeObjectURL }))
    const fetcher = vi.fn(async (input: string | URL) => String(input).includes('missing')
      ? new Response('{}', { status: 404 })
      : new Response(new Blob(['portrait'], { type: 'image/webp' })))
    const adapter = createLocalBridgeAdapter({ origin: 'http://localhost:3000', token: 'test', fetch: fetcher as typeof fetch })
    const source = { characters: [{ id: 'hero', name: 'Hero', avatar: 'art/default.webp', avatars: {
      default: { src: 'art/default.webp', label: '日常' },
      thoughtful: { src: 'art/thoughtful.webp', label: '思索' },
      remote: { src: 'https://example.com/hero.webp' },
      missing: { src: 'art/missing.webp' },
    } }, { id: 'no-portrait', name: 'No portrait', avatar: 'art/missing.webp' }], scenes: [] }
    const preview = await adapter.resolvePreviewConfig({ project: {} } as any, source as any)
    expect(preview.characters[0]?.avatars?.default.src).toBe(preview.characters[0]?.avatar)
    expect(preview.characters[0]?.avatars?.thoughtful).toEqual({ src: 'blob:portrait-2', label: '思索' })
    expect(preview.characters[0]?.avatars?.remote.src).toBe('https://example.com/hero.webp')
    expect(preview.characters[0]?.avatars?.missing).toBeUndefined()
    expect(preview.characters[1]?.avatar).toBeUndefined()
    expect(source.characters[0]?.avatars.thoughtful.src).toBe('art/thoughtful.webp')
    expect(fetcher).toHaveBeenCalledTimes(3)
    await adapter.resolvePreviewConfig({ project: {} } as any, { characters: [], scenes: [] } as any)
    expect(revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('loads local dialogue avatars, preserves remote avatars and releases cached URLs', async () => {
    const createObjectURL = vi.fn(() => 'blob:portrait')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/__advjs/api/asset?path=adv%2Fassets%2Favatars%2Fliu-bei.webp')
      expect(init?.headers).toMatchObject({ authorization: 'Bearer test' })
      return new Response(new Blob(['portrait'], { type: 'image/webp' }))
    })
    const adapter = createLocalBridgeAdapter({ origin: 'http://127.0.0.1:3000', token: 'test', fetch: fetcher as typeof fetch })
    const source = {
      characters: [
        { id: 'liu-bei', name: '刘备', avatar: 'adv/assets/avatars/liu-bei.webp' },
        { id: 'remote', name: 'Remote', avatar: 'https://example.com/portrait.webp' },
        { id: 'narrator', name: 'Narrator' },
      ],
      scenes: [],
    }
    const config = await adapter.resolvePreviewConfig({ project: {} } as any, source as any)
    expect(config.characters[0]?.avatar).toBe('blob:portrait')
    expect(config.characters[1]?.avatar).toBe('https://example.com/portrait.webp')
    expect(config.characters[2]?.avatar).toBeUndefined()
    expect(source.characters[0]?.avatar).toBe('adv/assets/avatars/liu-bei.webp')
    expect(fetcher).toHaveBeenCalledOnce()
    await adapter.resolvePreviewConfig({ project: {} } as any, { characters: [], scenes: [] } as any)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:portrait')
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
})
