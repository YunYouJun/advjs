import type { Component } from 'vue'
import type { ActivityRendererRegistry, AdvClientRuntimePlugin } from '../types/activity'

export function createActivityRendererRegistry(
  plugins: readonly AdvClientRuntimePlugin[] = [],
): ActivityRendererRegistry {
  const renderers = new Map<string, Component>()

  for (const plugin of plugins) {
    for (const [type, renderer] of Object.entries(plugin.activityRenderers ?? {})) {
      if (!type.startsWith(`${plugin.name}/`))
        throw new Error(`ADV_ACTIVITY_RENDERER_INVALID_NAME: ${type}`)
      if (renderers.has(type))
        throw new Error(`ADV_ACTIVITY_RENDERER_CONFLICT: ${type}`)
      renderers.set(type, renderer)
    }
  }

  return {
    resolve: type => renderers.get(type),
    list: () => [...renderers.keys()].sort(),
  }
}
