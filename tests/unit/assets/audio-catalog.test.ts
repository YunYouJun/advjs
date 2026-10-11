import { describe, expect, it } from 'vitest'
import { createAdvAssetCatalog } from '../../../packages/assets/src/catalog'

describe('audio asset categories', () => {
  it.each(['bgm', 'ambience', 'voice', 'sfx', 'ui', 'reference'])('infers %s as audio while preserving its separate domain kind', async (kind) => {
    const catalog = createAdvAssetCatalog({ schemaVersion: 2, id: 'audio', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'assets' } }, assets: [{ id: `audio/${kind}`, kind, path: `${kind}.wav` }] })
    expect(catalog.list({ type: 'audio', kind })).toMatchObject([{ id: `audio/${kind}`, type: 'audio', kind }])
    expect(await catalog.resolve(`audio/${kind}`)).toMatchObject({ type: 'audio', kind, src: `assets/${kind}.wav` })
  })
})
