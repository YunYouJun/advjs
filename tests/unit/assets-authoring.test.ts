import { planAdvAssetManifestUpsert } from '@advjs/assets'
import { describe, expect, it } from 'vitest'

const asset = {
  id: 'background/library',
  kind: 'background',
  type: 'image' as const,
  path: 'backgrounds/library.aaaaaaaaaaaa.webp',
  sha256: 'a'.repeat(64),
}

describe('asset manifest authoring plan', () => {
  it('creates a split local catalog for a new project', () => {
    const plan = planAdvAssetManifestUpsert({
      files: {},
      rootPath: 'adv/assets.json',
      catalogId: 'example',
      asset,
    })

    expect(Object.keys(plan.writes).sort()).toEqual([
      'adv/assets.json',
      'adv/assets/backgrounds.json',
    ])
    expect(plan.manifest.assets).toEqual([expect.objectContaining({ id: asset.id })])
  })

  it('preserves production defaults while adding a local authoring profile', () => {
    const plan = planAdvAssetManifestUpsert({
      files: {
        'adv/assets.json': JSON.stringify({
          schemaVersion: 2,
          id: 'example',
          defaultProfile: 'production',
          profiles: { production: { provider: 'http', baseUrl: 'https://example.com/' } },
          assets: [],
        }),
      },
      rootPath: 'adv/assets.json',
      catalogId: 'example',
      asset,
    })

    expect(plan.manifest.defaultProfile).toBe('production')
    expect(plan.manifest.profiles.local).toEqual({
      provider: 'project',
      root: 'adv/assets',
      fallback: 'production',
    })
  })

  it('requires separate explicit approval to replace an existing asset id', () => {
    expect(() => planAdvAssetManifestUpsert({
      files: {
        'adv/assets.json': JSON.stringify({
          schemaVersion: 2,
          id: 'example',
          defaultProfile: 'local',
          profiles: { local: { provider: 'project', root: 'adv/assets' } },
          assets: [{ ...asset, path: 'backgrounds/library.old.webp', sha256: 'b'.repeat(64) }],
        }),
      },
      rootPath: 'adv/assets.json',
      catalogId: 'example',
      asset,
    })).toThrow('pass replaceExisting only after explicit review')
  })
})
