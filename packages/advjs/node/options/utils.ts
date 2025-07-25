import type { AdvData } from '@advjs/types'

import type { AdvEntryOptions, ResolvedAdvOptions } from './types'
import path, { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { uniq } from '@antfu/utils'
import _debug from 'debug'
import fs from 'fs-extra'
import { loadAdvConfigs } from '../config'

import { getRoots, packageExists, resolveImportPath } from '../resolver'

import { getThemeMeta, resolveThemeName } from '../themes'

export const debug = _debug('adv:options')

export async function getClientRoot() {
  const importPath = await resolveImportPath('@advjs/client/package.json', true)
  return dirname(importPath)
}

export function isPath(name: string) {
  return name.startsWith('/') || /^\.\.?[/\\]/.test(name)
}

export async function getRoot(name: string, entry: string = process.cwd()) {
  if (isPath(name))
    return resolve(dirname(entry), name)
  return dirname(await resolveImportPath(`${name}/package.json`, true))
}

/**
 * Get user root directory
 * @param options
 */
export function getUserRoot(options: AdvEntryOptions) {
  const { userRoot = process.cwd() } = options
  return { userRoot }
}

export async function resolveOptions(
  options: AdvEntryOptions,
  mode: ResolvedAdvOptions['mode'],
): Promise<ResolvedAdvOptions> {
  const { remote } = options
  const rootsInfo = await getRoots(options)

  /**
   * Load adv.js config
   */
  const {
    config,
    configFile = '',
    gameConfig,
    gameConfigFile = '',
    themeConfig,
    themeConfigFile = '',
  } = await loadAdvConfigs(options)

  const data: AdvData = {
    config,
    configFile,
    gameConfig,
    gameConfigFile,
    themeConfig,
    themeConfigFile,
  } as AdvData

  const theme = await resolveThemeName(options.theme)
  /**
   * load theme config
   */

  if (!await packageExists(theme)) {
    console.error(`Theme "${theme}" not found, have you installed it?`)
    process.exit(1)
  }

  const pkg = await fs.readJSON(`${rootsInfo.themeRoot}/package.json`)
  themeConfig.pkg = pkg

  const gameRoot = path.resolve(rootsInfo.userRoot, data.config.root || 'adv')
  const roots = uniq([
    rootsInfo.clientRoot,
    rootsInfo.themeRoot,
    rootsInfo.userRoot,
    gameRoot,
  ])

  const advOptions: ResolvedAdvOptions = {
    env: options.env || 'app',
    theme: options.theme || 'default',
    themePkgName: theme,

    data,
    mode,

    roots,
    ...rootsInfo,
    gameRoot,

    remote,

    build: {
      singlefile: false,
    },
  }

  if (rootsInfo.themeRoot) {
    const themeMeta = await getThemeMeta(theme, join(rootsInfo.themeRoot, 'package.json'))
    data.themeMeta = themeMeta
  }
  else {
    throw new Error('[ADV] Can not find your ADV.JS Theme')
  }

  debug(advOptions)
  return advOptions
}
