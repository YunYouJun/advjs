import prompts from 'prompts'
import { parseNi, run } from '@antfu/ni'
import isInstalledGlobally from 'is-installed-globally'
import { underline } from 'kolorist'
import fs from 'fs-extra'
import type { AdvThemeMeta } from '@advjs/types'
import { satisfies } from 'semver'
import { version } from '../package.json'
import { packageExists } from './utils'
import { isPath } from './options'

const officialThemes: Record<string, string> = {
  none: '',
  default: '@advjs/theme-default',
}

/**
 * check version
 * @param name
 * @param path
 */
export async function getThemeMeta(name: string, path: string) {
  if (!fs.existsSync(path))
    return {}

  if (path) {
    const { advjs = {}, engines = {} } = await fs.readJSON(path)

    if (engines.advjs && !satisfies(version, engines.advjs))
      throw new Error(`[advjs] theme "${name}" requires ADV.JS version range "${engines.advjs}" but found "${version}"`)

    return advjs as AdvThemeMeta
  }
  return undefined
}

export async function resolveThemeName(name: string) {
  if (!name || name === 'none')
    name = 'default'

  if (name.startsWith('@advjs/theme-') || name.startsWith('advjs-theme-'))
    return name
  if (isPath(name))
    return name

  // search for local packages first
  if (await packageExists(`@advjs/theme-${name}`))
    return `@advjs/theme-${name}`
  if (await packageExists(`advjs-theme-${name}`))
    return `advjs-theme-${name}`
  if (await packageExists(name))
    return name

  // fallback to prompt install
  if (officialThemes[name] != null)
    return officialThemes[name]
  if (name.indexOf('@') === 0 && name.includes('/'))
    return name
  return `advjs-theme-${name}`
}

export async function promptForThemeInstallation(name: string) {
  name = await resolveThemeName(name)
  if (!name)
    return name

  if (isPath(name) || await packageExists(name))
    return name

  const { confirm } = await prompts({
    name: 'confirm',
    initial: 'Y',
    type: 'confirm',
    message: `The theme "${name}" was not found ${underline(isInstalledGlobally ? 'globally' : 'in your project')}, do you want to install it now?`,
  })

  if (!confirm)
    return false

  if (isInstalledGlobally)
    await run(parseNi, ['-g', name])
  else
    await run(parseNi, [name])

  return name
}
