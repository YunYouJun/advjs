import { civilization, starMap } from '@advjs/plugin-interactions'

/**
 * Official runtime plugins shipped with the App (App Review 2.5.2: no
 * downloaded or project-supplied code). Activity renderers live in the
 * player; the engine only needs their actions and nodes to validate.
 */
export function officialRuntimePlugins() {
  return [starMap(), civilization()]
}

/** Exact versions the compiler may accept, keyed by plugin name. */
export function officialPluginVersions(): Record<string, string> {
  return Object.fromEntries(officialRuntimePlugins().map(plugin => [plugin.name, plugin.version]))
}
