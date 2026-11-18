import type { Plugin } from 'vite'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { readEditorPluginPackage } from '@advjs/editor-sdk/node'

/** Explicit trusted build inputs. Never load plugin URLs from a project or runtime query. */
export function editorBundledPlugins(input?: string, packagesInput?: string): Plugin {
  const entries: unknown = input ? JSON.parse(input) : []
  if (!Array.isArray(entries) || entries.some(entry => typeof entry !== 'string' || !isAbsolute(entry) || !existsSync(entry)))
    throw new Error('ADVJS_EDITOR_PLUGIN_ENTRIES must be a JSON array of existing absolute local module paths')
  const packages: unknown = packagesInput ? JSON.parse(packagesInput) : []
  if (!Array.isArray(packages) || packages.some(p => typeof p !== 'string' || !isAbsolute(p)))
    throw new Error('ADVJS_EDITOR_PLUGIN_PACKAGES must be a JSON array of trusted absolute package directories')
  const manifests = packages.map(readEditorPluginPackage)
  if (new Set(manifests.map(p => p.id)).size !== manifests.length)
    throw new Error('Duplicate Editor plugin package id')
  const modules = [...entries, ...manifests.map(p => p.entry)]
  const styles = [...new Set(manifests.flatMap(p => p.styles))]
  const id = 'virtual:advjs-editor-bundled-plugins'
  return {
    name: 'advjs-editor-bundled-plugins',
    resolveId: source => source === id ? `\0${id}` : undefined,
    load(source) {
      if (source !== `\0${id}`)
        return
      return `${styles.map(style => `import ${JSON.stringify(style)}`).join('\n')}\n${modules.map((entry, index) => `import plugin${index} from ${JSON.stringify(entry)}`).join('\n')}\nexport default [${modules.map((_, index) => `plugin${index}`).join(',')}]`
    },
  }
}
