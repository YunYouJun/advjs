import type { AdvData, AdvEntryOptions, ResolvedAdvOptions, RootsInfo } from '@advjs/types'

import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { uniq } from '@antfu/utils'
import _debug from 'debug'
import fs from 'fs-extra'
import { loadAdvConfigs } from '../config'

import { resolvePlugins } from '../plugins/resolve'

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
  // load theme from adv.config.ts
  if (!options.theme) {
    options.theme = config.theme || 'default'
  }
  else {
    config.theme = options.theme
  }
  const themePkgName = await resolveThemeName(options.theme)
  options.theme = themePkgName

  const data: AdvData = {
    config,
    configFile,
    gameConfig,
    gameConfigFile,
    themeConfig,
    themeConfigFile,
  } as AdvData

  /**
   * load theme config
   */

  if (!await packageExists(themePkgName)) {
    console.error(`Theme "${themePkgName}" not found, have you installed it?`)
    process.exit(1)
  }

  const advOptions: ResolvedAdvOptions = {
    ...options,
    env: options.env || 'app',
    theme: options.theme || 'default',
    themePkgName,

    data,
    mode,

    plugins: [],

    // root
    roots: [],
    gameRoot: '',
    cliRoot: '',
    userRoot: '',
    clientRoot: '',
    themeRoot: '',
    tempRoot: '',
    userWorkspaceRoot: '',

    remote,

    build: {
      singlefile: options.singlefile,
    },
  }

  const rootsInfo = await getRoots(options, config)
  const pkg = await fs.readJSON(`${rootsInfo.themeRoot}/package.json`)
  themeConfig.pkg = pkg

  advOptions.roots = uniq([
    rootsInfo.clientRoot,
    rootsInfo.themeRoot,
    rootsInfo.userRoot,
    rootsInfo.gameRoot,
  ])
  Object.keys(rootsInfo).forEach((key) => {
    (advOptions as any)[key] = rootsInfo[key as keyof RootsInfo]
  })

  if (rootsInfo.themeRoot) {
    const themeMeta = await getThemeMeta(themePkgName, join(rootsInfo.themeRoot, 'package.json'))
    data.themeMeta = themeMeta
  }
  else {
    throw new Error('[ADV] Can not find your ADV.JS Theme')
  }

  debug(advOptions)

  advOptions.plugins = await resolvePlugins(config.plugins, advOptions.userRoot)
  // await
  for (const plugin of advOptions.plugins) {
    if (plugin.optionsResolved)
      await plugin.optionsResolved(advOptions)
  }

  return advOptions
}
