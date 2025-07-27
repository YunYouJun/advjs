import type { AdvPlugin, ResolvedAdvPlugin } from '@advjs/types'
import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import { getModuleRoot } from '../utils/root'

/**
 * get plugin root directory
 *
 * - @advjs/plugin-*
 * - advjs-plugin-*
 */
export async function getPluginRoot(pluginName: string, userRoot = process.cwd()) {
  return await getModuleRoot(pluginName, userRoot)
}

/**
 * resolve one plugin
 */
export async function resolvePlugin(plugin: AdvPlugin, userRoot = process.cwd()) {
  const pluginRoot = await getPluginRoot(plugin.name, userRoot)
  const pkgPath = path.resolve(pluginRoot, 'package.json')

  if (!(await fs.pathExists(pkgPath))) {
    throw new Error(`Plugin "${plugin.name}" not found at ${pluginRoot}. Please ensure it is installed in your project.`)
  }

  const packageJSON = await fs.readJSON(pkgPath)
  const resolvedPlugin: ResolvedAdvPlugin = {
    ...plugin,
    root: pluginRoot,
    pkg: packageJSON,
  }
  return resolvedPlugin
}

/**
 * resolve advjs plugins
 */
export async function resolvePlugins(plugins: AdvPlugin[], userRoot = process.cwd()) {
  // Using Promise.all for parallel resolution
  const resolvedPluginPromises = plugins.map(plugin => resolvePlugin(plugin, userRoot))
  const resolvedPlugins = await Promise.all(resolvedPluginPromises)

  return resolvedPlugins
}
