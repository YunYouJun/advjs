import type { AdvAssetLocationAdapter, AdvAssetManifest } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createAdvAssetCatalog } from '../../src/assets'

function createMemoryAdapter(files: Record<string, string>): AdvAssetLocationAdapter {
  return {
    async resolve(request) {
      if (request.provider === 'project') {
        const value = files[request.location]
        if (!value)
          throw new Error(`Missing project asset: ${request.location}`)
        return value
      }
      return new URL(request.location, request.baseUrl).href
    },
  }
}

describe('asset catalog', () => {
  it('resolves the same asset ID through project and HTTP profiles', async () => {
    const manifest: AdvAssetManifest = {
      schemaVersion: 2,
      id: 'catalog-test',
      defaultProfile: 'production',
      profiles: {
        local: { provider: 'project', root: '.' },
        production: { provider: 'http', baseUrl: 'https://assets.example.com/' },
      },
      bundles: [
        { id: 'chapter-01', preload: true },
      ],
      assets: [
        {
          id: 'background/room',
          kind: 'background',
          type: 'image',
          bundle: 'chapter-01',
          path: 'adv/assets/backgrounds/room.webp',
          objectKey: 'games/demo/v1/backgrounds/room.abc12345.webp',
          sha256: 'abc12345',
          license: 'CC-BY-4.0',
          source: { type: 'original', createdAt: '2026-07-20' },
          variants: {
            thumbnail: {
              path: 'adv/assets/backgrounds/room.thumbnail.webp',
              objectKey: 'games/demo/v1/backgrounds/room.thumbnail.def67890.webp',
            },
          },
        },
      ],
    }
    const catalog = createAdvAssetCatalog(manifest, {
      adapter: createMemoryAdapter({
        'adv/assets/backgrounds/room.webp': 'blob:room',
        'adv/assets/backgrounds/room.thumbnail.webp': 'blob:room-thumbnail',
      }),
    })

    await expect(catalog.resolve('background/room', { profile: 'local' }))
      .resolves
      .toMatchObject({ src: 'blob:room', bundle: 'chapter-01', type: 'image' })
    await expect(catalog.resolve('background/room', { profile: 'production', variant: 'thumbnail' }))
      .resolves
      .toMatchObject({
        src: 'https://assets.example.com/games/demo/v1/backgrounds/room.thumbnail.def67890.webp',
        variant: 'thumbnail',
      })
    expect(catalog.list({ bundle: 'chapter-01' }).map(asset => asset.id)).toEqual(['background/room'])
    expect(catalog.get('background/room')).toMatchObject({
      license: 'CC-BY-4.0',
      source: { type: 'original', createdAt: '2026-07-20' },
    })
  })
})
