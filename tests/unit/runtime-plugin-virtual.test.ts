import type { ResolvedAdvOptions } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { templateRuntimePlugins } from '../../packages/advjs/node/virtual/runtime-plugins'

describe('runtime plugin virtual module', () => {
  it('reconstructs browser plugins from static factory descriptors', async () => {
    const options = {
      userRoot: '/game',
      data: {
        config: {
          plugins: [
            {
              name: 'star-map',
              version: '1.0.0',
              client: {
                module: '@advjs/plugin-interactions',
                export: 'starMap',
                options: { tolerance: 0.82 },
              },
            },
            { name: '@advjs/plugin-build-only' },
          ],
        },
      },
    } as unknown as ResolvedAdvOptions

    const code = await templateRuntimePlugins.getContent.call({} as never, options)

    expect(code).toContain('import { starMap as __advRuntimePlugin0 } from "@advjs/plugin-interactions"')
    expect(code).toContain('__advRuntimePlugin0({"tolerance":0.82})')
    expect(code).not.toContain('plugin-build-only')
  })
})
