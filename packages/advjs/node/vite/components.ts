import type { ResolvedAdvOptions } from '@advjs/types'
import type { AdvPluginOptions } from '../options'
import { existsSync, readdirSync } from 'node:fs'
import path, { join } from 'node:path'
import Components from 'unplugin-vue-components/vite'

const vueFilePattern = /\.vue$/
const vueQueryPattern = /\.vue\?vue/
const mdFilePattern = /\.md$/
const gitExcludePattern = /[\\/]\.git[\\/]/
const nuxtExcludePattern = /[\\/]\.nuxt[\\/]/

function componentFiles(directory: string): string[] {
  if (!existsSync(directory))
    return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name)
    if (entry.isDirectory())
      return componentFiles(file)
    return entry.isFile() && (file.endsWith('.vue') || file.endsWith('.md')) ? [file] : []
  })
}

/**
 * fast-glob returns paths in lexical order, so `allowOverrides` alone cannot
 * express root priority. Exclude lower-priority files with the same component
 * filename before unplugin-vue-components builds its name map.
 */
export function createPrioritizedComponentGlobs(directories: string[]): string[] {
  const files = directories.map(componentFiles)
  const seen = new Set<string>()
  const excludes: string[] = []
  for (let index = files.length - 1; index >= 0; index--) {
    for (const file of files[index]) {
      const name = path.basename(file).toLowerCase()
      if (seen.has(name))
        excludes.push(`!${file}`)
      else
        seen.add(name)
    }
  }
  return [
    ...directories.map(directory => `${directory}/**/*.{vue,md}`),
    ...excludes,
  ]
}

/**
 * @see // https://github.com/antfu/unplugin-vue-components
 * @param options
 * @param pluginOptions
 */
export function createComponentsPlugin(options: ResolvedAdvOptions, pluginOptions: AdvPluginOptions) {
  const directories = [
    join(options.clientRoot, 'builtin'),
    ...options.roots.map(root => join(root, 'components')),
    ...pluginOptions.components?.dirs || [],
  ]
  return Components({
    extensions: ['vue', 'md'],

    include: [vueFilePattern, vueQueryPattern, mdFilePattern],
    // node_modules is needed to be search when install deps
    exclude: [gitExcludePattern, nuxtExcludePattern],
    dts: path.resolve(options.tempRoot, 'components.d.ts'),

    allowOverrides: true,

    ...pluginOptions.components,
    dirs: directories,
    globs: [
      ...createPrioritizedComponentGlobs(directories),
      ...pluginOptions.components?.globs || [],
    ],
  })
}
