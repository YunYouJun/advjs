import type { EditorPluginPackageManifest } from './host-protocol.ts'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, resolve, sep } from 'node:path'

/** Only explicit trusted build inputs. Never call this on a renderer/project-supplied path. */
export function readEditorPluginPackage(directory: string) {
  if (!isAbsolute(directory))
    throw new Error('Editor plugin package requires an absolute trusted directory')
  const root = realpathSync(directory)
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const metadata = pkg.advjs?.editorPlugin as EditorPluginPackageManifest | undefined
  if (!metadata || metadata.apiVersion !== 1 || typeof metadata.id !== 'string' || !/^[a-z][a-z0-9.-]*$/u.test(metadata.id)
    || typeof pkg.name !== 'string' || typeof pkg.version !== 'string'
    || (metadata.styles !== undefined && (!Array.isArray(metadata.styles) || metadata.styles.some(s => typeof s !== 'string')))) {
    throw new Error('Invalid Editor plugin package manifest (expected apiVersion 1)')
  }
  function file(path: string) {
    if (typeof path !== 'string' || !path.startsWith('./') || path.includes('\\'))
      throw new Error('Editor plugin entries must be package-relative files')
    const target = realpathSync(resolve(root, path))
    if (!target.startsWith(root + sep) || !statSync(target).isFile())
      throw new Error('Editor plugin entry escapes its package')
    return target
  }
  return { name: pkg.name as string, version: pkg.version as string, id: metadata.id, apiVersion: 1 as const, root, entry: file(metadata.entry), styles: (metadata.styles ?? []).map(file), host: metadata.host === undefined ? undefined : file(metadata.host) }
}
