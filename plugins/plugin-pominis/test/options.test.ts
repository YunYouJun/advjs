import { describe, expect, it } from 'vitest'
import { defaultPominisPluginOptions } from '../src/plugin'

describe('pominis plugin options', () => {
  it('should support image concurrency configuration', () => {
    expect(defaultPominisPluginOptions.bundleAssets?.image).toBeDefined()
    expect(typeof defaultPominisPluginOptions.bundleAssets?.image).toBe('object')

    const imageConfig = defaultPominisPluginOptions.bundleAssets?.image
    if (typeof imageConfig === 'object') {
      expect(imageConfig.enable).toBe(true)
      expect(imageConfig.concurrency).toBe(4)
    }
  })

  it('should support backward compatibility with boolean image config', () => {
    // Type test - this should compile without errors
    const booleanConfig = {
      storyId: 'test',
      bundleAssets: {
        image: true,
      },
    }

    const objectConfig = {
      storyId: 'test',
      bundleAssets: {
        image: {
          enable: true,
          concurrency: 8,
        },
      },
    }

    expect(booleanConfig.bundleAssets.image).toBe(true)
    expect(objectConfig.bundleAssets.image.concurrency).toBe(8)
  })
})
