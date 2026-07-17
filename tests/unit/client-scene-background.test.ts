import type { AdvScene } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { resolveSceneBackground } from '../../packages/client/utils/scene'

const scenes: AdvScene[] = [
  { id: 'summer-room', alias: 'opening', type: 'image', src: '/art/summer-room.webp' },
  { id: 'orbit', type: 'model' },
]

describe('scene background resolution', () => {
  it('resolves scene ids and aliases to image sources', () => {
    expect(resolveSceneBackground('summer-room', scenes)).toBe('/art/summer-room.webp')
    expect(resolveSceneBackground('opening', scenes)).toBe('/art/summer-room.webp')
  })

  it('preserves direct URLs and non-image scene ids', () => {
    expect(resolveSceneBackground('/img/direct.webp', scenes)).toBe('/img/direct.webp')
    expect(resolveSceneBackground('orbit', scenes)).toBe('orbit')
  })
})
