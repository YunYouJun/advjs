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
                activities: {
                  compare: {
                    module: '@advjs/plugin-interactions/client/StarMapActivity.vue',
                    export: 'default',
                  },
                },
              },
            },
            { name: '@advjs/plugin-build-only' },
          ],
        },
      },
    } as unknown as ResolvedAdvOptions

    const code = await templateRuntimePlugins.getContent.call({} as never, options)

    expect(code).toContain('import { starMap as __advRuntimePlugin0 } from "@advjs/plugin-interactions"')
    expect(code).toContain('import __advActivityRenderer0 from "@advjs/plugin-interactions/client/StarMapActivity.vue"')
    expect(code).toContain('Object.assign(__advRuntimePlugin0({"tolerance":0.82}),{"activityRenderers":{"star-map/compare":__advActivityRenderer0}})')
    expect(code).not.toContain('plugin-build-only')
  })

  it.each([
    ['activity name', 'not/valid', 'default', 'Invalid runtime activity renderer name: not/valid'],
    ['renderer export', 'compare', 'not-valid', 'Invalid runtime activity renderer export: not-valid'],
  ])('rejects an invalid %s', async (_, activityName, rendererExport, message) => {
    const options = {
      userRoot: '/game',
      data: {
        config: {
          plugins: [{
            name: 'star-map',
            version: '1.0.0',
            client: {
              module: '@advjs/plugin-interactions',
              activities: {
                [activityName]: {
                  module: './Activity.vue',
                  export: rendererExport,
                },
              },
            },
          }],
        },
      },
    } as unknown as ResolvedAdvOptions

    await expect(() => templateRuntimePlugins.getContent.call({} as never, options))
      .toThrow(message)
  })
})
