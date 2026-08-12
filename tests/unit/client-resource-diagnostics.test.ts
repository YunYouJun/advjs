// @vitest-environment node

import type { AdvGameConfig } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import {
  validateSpritesheetDeclarations,
  validateSpritesheetImages,
} from '../../packages/client/runtime/resource-diagnostics'

function config(sprite: { frameWidth: number, frameHeight: number, frames: number, fps: number }): AdvGameConfig {
  return {
    title: 'fixture',
    description: '',
    favicon: '',
    bgm: { autoplay: false },
    assets: { manifest: { bundles: [] } },
    chapters: [],
    scenes: [],
    characters: [{
      id: 'hamster',
      name: 'Hamster',
      tachies: { running: { src: 'running.webp', sprite } },
    }],
  }
}

describe('client presentation resource diagnostics', () => {
  it('rejects invalid declarations', () => {
    const diagnostics = validateSpritesheetDeclarations(config({
      frameWidth: 0,
      frameHeight: 512,
      frames: 6,
      fps: 10,
    }))
    expect(diagnostics[0]?.code).toBe('ADV_RUNTIME_INVALID_SPRITESHEET')
  })

  it('checks actual sheet dimensions', async () => {
    const diagnostics = await validateSpritesheetImages(config({
      frameWidth: 512,
      frameHeight: 512,
      frames: 6,
      fps: 10,
    }), async () => ({ width: 2560, height: 512 }))
    expect(diagnostics[0]?.code).toBe('ADV_RUNTIME_SPRITESHEET_DIMENSION_MISMATCH')
  })
})
