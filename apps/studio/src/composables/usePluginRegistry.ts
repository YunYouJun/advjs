import type { StudioPlugin, StudioPluginType } from '../utils/pluginTypes'
import { listAiProviders, registerAiProvider, unregisterAiProvider } from '../utils/aiProviderRegistry'
import { listTtsProviders } from '../utils/ttsClient'

/**
 * Unified plugin registry composable.
 *
 * Aggregates AI Provider and TTS Provider registries into a single
 * discovery and management API. Export format plugins are reserved
 * for future extension.
 */
export function usePluginRegistry() {
  /**
   * List all registered plugins, optionally filtered by type.
   */
  function listPlugins(type?: StudioPluginType): StudioPlugin[] {
    const plugins: StudioPlugin[] = []

    if (!type || type === 'ai-provider') {
      for (const p of listAiProviders()) {
        plugins.push(p)
      }
    }

    if (!type || type === 'tts-provider') {
      for (const p of listTtsProviders()) {
        plugins.push({
          id: p.id,
          name: p.name,
          type: 'tts-provider',
          version: '1.0.0',
        })
      }
    }

    return plugins
  }

  /**
   * Get a plugin by type and id.
   */
  function getPlugin(type: StudioPluginType, id: string): StudioPlugin | undefined {
    return listPlugins(type).find(p => p.id === id)
  }

  /**
   * Register a new plugin. Currently only AI providers support dynamic registration.
   */
  function registerPlugin(plugin: StudioPlugin & Record<string, any>): boolean {
    if (plugin.type === 'ai-provider') {
      registerAiProvider(plugin as any)
      return true
    }
    // TTS providers: use registerTtsProvider() directly from ttsClient.ts
    // Export formats: reserved for future
    return false
  }

  /**
   * Unregister a plugin by type and id.
   */
  function unregisterPlugin(type: StudioPluginType, id: string): boolean {
    if (type === 'ai-provider')
      return unregisterAiProvider(id)
    return false
  }

  return {
    listPlugins,
    getPlugin,
    registerPlugin,
    unregisterPlugin,
  }
}
