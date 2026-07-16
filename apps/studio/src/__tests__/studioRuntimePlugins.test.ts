import { describe, expect, it } from 'vitest'
import { createStudioRuntimePlugins } from '../utils/studioRuntimePlugins'

describe('studio runtime plugins', () => {
  it('returns the explicit official interaction allowlist', () => {
    const plugins = createStudioRuntimePlugins()

    expect(plugins.map(plugin => plugin.name)).toEqual([
      'star-map',
      'civilization',
    ])
    expect(plugins[0]).toMatchObject({
      version: '1.0.0',
      nodes: { compare: expect.any(Function) },
      activities: { compare: expect.any(Function) },
      activityRenderers: { 'star-map/compare': expect.any(Object) },
    })
    expect(plugins[1]).toMatchObject({
      version: '1.0.0',
      nodes: { initialize: expect.any(Function) },
      activities: { initialize: expect.any(Function) },
      activityRenderers: { 'civilization/initialize': expect.any(Object) },
    })
  })
})
