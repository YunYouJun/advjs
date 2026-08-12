import type { IFileSystem } from '../utils/fs'
import { describe, expect, it, vi } from 'vitest'
import { loadStudioAssetCatalog, upsertStudioProjectAsset } from '../utils/projectAssets'

function createFs(manifest: unknown, blobs: Record<string, string>): IFileSystem {
  return {
    backend: 'memory',
    exists: async (path: string) => path === 'adv/assets.json' || Object.hasOwn(blobs, path),
    readFile: async (path: string) => path === 'adv/assets.json' ? JSON.stringify(manifest) : '',
    readBlobUrl: vi.fn(async (path: string) => {
      const url = blobs[path]
      if (!url)
        throw new Error(`File not found: ${path}`)
      return url
    }),
  } as unknown as IFileSystem
}

describe('studio project asset catalog', () => {
  it('prefers project files and falls back to the published profile', async () => {
    const fs = createFs({
      schemaVersion: 2,
      id: 'studio-project',
      defaultProfile: 'production',
      profiles: {
        local: { provider: 'project', fallback: 'production' },
        production: { provider: 'http', baseUrl: 'https://assets.example.com/' },
      },
      assets: [
        {
          id: 'background/local',
          kind: 'background',
          type: 'image',
          path: 'adv/assets/backgrounds/local.webp',
          objectKey: 'published/local.12345678.webp',
        },
        {
          id: 'background/remote',
          kind: 'background',
          type: 'image',
          objectKey: 'published/remote.87654321.webp',
        },
      ],
    }, {
      'adv/assets/backgrounds/local.webp': 'blob:local',
    })

    const catalog = await loadStudioAssetCatalog(fs)

    await expect(catalog?.resolve('background/local')).resolves.toMatchObject({ src: 'blob:local' })
    await expect(catalog?.resolve('background/remote')).resolves.toMatchObject({
      src: 'https://assets.example.com/published/remote.87654321.webp',
    })
  })

  it('merges fragments declared by the canonical root catalog', async () => {
    const files: Record<string, string> = {
      'adv/assets.json': JSON.stringify({
        schemaVersion: 2,
        id: 'split-project',
        defaultProfile: 'local',
        profiles: { local: { provider: 'project', root: 'adv/assets' } },
        includes: ['assets/backgrounds.json', 'assets/audio.json'],
      }),
      'adv/assets/backgrounds.json': JSON.stringify({
        schemaVersion: 2,
        assets: [{ id: 'background/room', kind: 'background', type: 'image', path: 'backgrounds/room.webp' }],
      }),
      'adv/assets/audio.json': JSON.stringify({
        schemaVersion: 2,
        assets: [{ id: 'bgm/summer', kind: 'bgm', type: 'audio', path: 'audio/summer.ogg' }],
      }),
    }
    const fs = {
      backend: 'memory',
      exists: async (path: string) => Object.hasOwn(files, path) || path.endsWith('room.webp') || path.endsWith('summer.ogg'),
      readFile: async (path: string) => files[path],
      readBlobUrl: async (path: string) => `blob:${path}`,
    } as unknown as IFileSystem

    const catalog = await loadStudioAssetCatalog(fs)

    expect(catalog?.list().map(asset => asset.id)).toEqual(['background/room', 'bgm/summer'])
    await expect(catalog?.resolve('background/room')).resolves.toMatchObject({
      src: 'blob:adv/assets/backgrounds/room.webp',
    })
  })

  it('rejects split-catalog includes that escape the asset directory', async () => {
    const fs = {
      backend: 'memory',
      exists: async (path: string) => path === 'adv/assets.json',
      readFile: async () => JSON.stringify({
        schemaVersion: 2,
        id: 'unsafe',
        defaultProfile: 'local',
        profiles: { local: { provider: 'project' } },
        includes: ['assets/../../settings/game.json'],
      }),
    } as unknown as IFileSystem

    await expect(loadStudioAssetCatalog(fs)).rejects.toThrow(/include path/u)
  })

  it('rejects a root catalog with both inline assets and includes', async () => {
    const fs = createFs({
      schemaVersion: 2,
      id: 'ambiguous',
      defaultProfile: 'local',
      profiles: { local: { provider: 'project', root: 'adv/assets' } },
      assets: [{ id: 'background/inline', kind: 'background', type: 'image', path: 'backgrounds/inline.webp' }],
      includes: ['assets/backgrounds.json'],
    }, {})

    await expect(loadStudioAssetCatalog(fs)).rejects.toThrow(/exactly one of assets or includes/u)
  })

  it('keeps the legacy nested index readable during migration', async () => {
    const files: Record<string, string> = {
      'adv/assets/index.json': JSON.stringify({
        schemaVersion: 2,
        id: 'legacy-split-project',
        defaultProfile: 'local',
        profiles: { local: { provider: 'project', root: 'adv/assets' } },
        includes: ['backgrounds.json'],
      }),
      'adv/assets/backgrounds.json': JSON.stringify({
        schemaVersion: 2,
        assets: [{ id: 'background/legacy', kind: 'background', type: 'image', path: 'backgrounds/legacy.webp' }],
      }),
    }
    const fs = {
      backend: 'memory',
      exists: async (path: string) => Object.hasOwn(files, path) || path.endsWith('legacy.webp'),
      readFile: async (path: string) => files[path],
      readBlobUrl: async (path: string) => `blob:${path}`,
    } as unknown as IFileSystem

    const catalog = await loadStudioAssetCatalog(fs)

    expect(catalog?.list().map(asset => asset.id)).toEqual(['background/legacy'])
  })

  it('creates a split local catalog and keeps stable IDs separate from paths', async () => {
    const files = new Map<string, string>()
    const fs = {
      backend: 'memory',
      exists: async (path: string) => files.has(path),
      readFile: async (path: string) => files.get(path) || '',
      writeFile: async (path: string, content: string) => { files.set(path, content) },
      mkdir: async () => {},
      deleteFile: async (path: string) => { files.delete(path) },
    } as unknown as IFileSystem

    await upsertStudioProjectAsset(fs, {
      id: 'background/summer-room',
      kind: 'background',
      type: 'image',
      path: 'backgrounds/summer-room.webp',
    }, { catalogId: 'demo' })

    const index = JSON.parse(files.get('adv/assets.json')!)
    const backgrounds = JSON.parse(files.get('adv/assets/backgrounds.json')!)
    expect(index).toMatchObject({
      schemaVersion: 2,
      id: 'demo',
      defaultProfile: 'local',
      profiles: { local: { provider: 'project', root: 'adv/assets' } },
      includes: ['assets/backgrounds.json'],
    })
    expect(backgrounds.assets).toEqual([
      expect.objectContaining({ id: 'background/summer-room', path: 'backgrounds/summer-room.webp' }),
    ])
    expect(files.has('adv/assets/index.json')).toBe(false)
  })

  it('migrates the legacy nested index on the next Studio write', async () => {
    const files = new Map<string, string>([
      ['adv/assets/index.json', JSON.stringify({
        schemaVersion: 2,
        id: 'legacy-project',
        defaultProfile: 'local',
        profiles: { local: { provider: 'project', root: 'adv/assets' } },
        includes: ['backgrounds.json'],
      })],
      ['adv/assets/backgrounds.json', JSON.stringify({
        schemaVersion: 2,
        assets: [{ id: 'background/old', kind: 'background', type: 'image', path: 'backgrounds/old.webp' }],
      })],
    ])
    const fs = {
      backend: 'memory',
      exists: async (path: string) => files.has(path),
      readFile: async (path: string) => files.get(path) || '',
      writeFile: async (path: string, content: string) => { files.set(path, content) },
      mkdir: async () => {},
      deleteFile: async (path: string) => { files.delete(path) },
    } as unknown as IFileSystem

    await upsertStudioProjectAsset(fs, {
      id: 'bgm/new',
      kind: 'bgm',
      type: 'audio',
      path: 'audio/new.ogg',
    }, { catalogId: 'ignored-when-migrating' })

    expect(JSON.parse(files.get('adv/assets.json')!).includes).toEqual([
      'assets/backgrounds.json',
      'assets/audio.json',
    ])
    expect(files.has('adv/assets/index.json')).toBe(false)
  })
})
