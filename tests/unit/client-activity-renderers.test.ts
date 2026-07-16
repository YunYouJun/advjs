import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { createActivityRendererRegistry } from '../../packages/client/runtime/activity-renderers'
import { setupAdvContext } from '../../packages/client/setup/context'

const renderer = defineComponent({
  name: 'TestActivityRenderer',
  setup: () => () => h('div'),
})

describe('activity renderer registry', () => {
  it('resolves a namespaced renderer', () => {
    const registry = createActivityRendererRegistry([{
      name: 'test',
      version: '1.0.0',
      activityRenderers: { 'test/open': renderer },
    }])

    expect(registry.resolve('test/open')).toBe(renderer)
    expect(registry.list()).toEqual(['test/open'])
  })

  it('rejects duplicate renderers', () => {
    const plugin = {
      name: 'test',
      version: '1.0.0',
      activityRenderers: { 'test/open': renderer },
    }

    expect(() => createActivityRendererRegistry([
      plugin,
      { ...plugin },
    ])).toThrow('ADV_ACTIVITY_RENDERER_CONFLICT: test/open')
  })

  it('rejects renderer keys outside the plugin namespace', () => {
    expect(() => createActivityRendererRegistry([{
      name: 'test',
      version: '1.0.0',
      activityRenderers: { 'other/open': renderer },
    }])).toThrow('ADV_ACTIVITY_RENDERER_INVALID_NAME: other/open')
  })

  it('exposes registered renderers through AdvContext', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const empty = computed(() => ({}))
    const context = setupAdvContext({
      config: empty as never,
      gameConfig: empty as never,
      themeConfig: empty as never,
      pinia,
      runtimePlugins: [{
        name: 'test',
        version: '1.0.0',
        activityRenderers: { 'test/open': renderer },
      }],
    })

    expect(context.activityRenderers.resolve('test/open')).toBe(renderer)
    context.runtime.dispose()
  })
})
