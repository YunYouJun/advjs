import { dirname } from 'node:path'
import fs from 'fs-extra'
import { resolve } from 'pathe'
import { isPath } from '../options'
import { resolveImportPath } from '../resolver'

/**
 * get theme/plugin roots
 * @param name
 * @param entry
 */
export async function getModuleRoot(name: string, entry?: string) {
  if (!name)
    return ''

  if (isPath(name)) {
    if (entry) {
      const isFile = fs.lstatSync(entry).isFile()
      return resolve(isFile ? dirname(entry) : entry, name)
    }
    else { throw new Error(`entry is required when ${name} is path`) }
  }

  else {
    return resolve(dirname(await resolveImportPath(`${name}/package.json`) || ''))
  }
}

/**
 * get theme roots
 * @param name valaxy-theme-name
 * @param entry
 */
export async function getAdvThemeRoot(name = '@advjs/theme-default', entry?: string) {
  const themeModule = (name.startsWith('@advjs/theme-') || name.startsWith('advjs-theme-') || name.startsWith('.')) ? name : `advjs-theme-${name}`
  return await getModuleRoot(themeModule, entry)
}
