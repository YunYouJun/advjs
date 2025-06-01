import type { AdvData } from '@advjs/types'
// import type RemoteAssets from 'vite-plugin-remote-assets'
// import type ServerRef from 'vite-plugin-vue-server-ref'
import type { ArgumentsType } from '@antfu/utils'
import type Vue from '@vitejs/plugin-vue'
import type { VitePluginConfig as UnoCSSConfig } from 'unocss/vite'
import type Components from 'unplugin-vue-components/vite'
import type Markdown from 'unplugin-vue-markdown'
import type { HmrContext } from 'vite'

import path, { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { uniq } from '@antfu/utils'
import _debug from 'debug'
import fs from 'fs-extra'
import { loadAdvConfigs } from './config'
import { getRoots, packageExists, resolveImportPath } from './resolver'

import { getThemeMeta, resolveThemeName } from './themes'

const debug = _debug('adv:options')

export interface AdvEntryOptions {
  /**
   * Markdown entry
   *
   * @default 'index.adv.md'
   *
   * @deprecated
   * 入口配置应该使用 `adv.config.ts` 以支持动态函数
   */
  entry?: string

  /**
   * Theme id
   */
  theme?: string

  remote?: boolean

  /**
   * Root path
   *
   * @default process.cwd()
   */
  userRoot?: string
}

export interface RootsInfo {
  entry: string
  /**
   * root path
   */
  userRoot: string
  cliRoot: string
  clientRoot: string
  themeRoot: string
  /**
   * '.adv' directory
   */
  tempRoot: string
  userWorkspaceRoot: string
}

export interface ResolvedAdvOptions extends RootsInfo {
  /**
   * 都放在 data 下以便一起处理 HMR
   */
  data: AdvData

  mode: 'dev' | 'build'
  remote?: boolean
  /**
   * Base URL in dev or build mode
   */
  base?: string

  /**
   * Custom Game Root in adv.config.ts 'root'
   * @default 'adv'
   */
  gameRoot: string
  /**
   * = `[clientRoot, ...themeRoots, ...addonRoots, userRoot]`
   */
  roots: string[]
}

export interface AdvPluginOptions extends AdvEntryOptions {
  vue?: ArgumentsType<typeof Vue>[0]
  markdown?: ArgumentsType<typeof Markdown>[0]
  components?: ArgumentsType<typeof Components>[0]
  unocss?: UnoCSSConfig
  // remoteAssets?: ArgumentsType<typeof RemoteAssets>[0]
  // serverRef?: ArgumentsType<typeof ServerRef>[0]
}

export interface AdvServerOptions {
  /**
   * @returns `false` if server should be restarted
   */
  loadData?: (ctx: HmrContext, loadedSource: Record<string, string>) => Promise<AdvData | false>
}

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

export function getUserRoot(options: AdvEntryOptions) {
  const { entry: rawEntry = 'index.adv.md', userRoot = process.cwd() } = options
  const fullEntry = resolve(userRoot, rawEntry)
  return { entry: fullEntry, userRoot: dirname(fullEntry) }
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
    data,
    mode,

    roots,
    ...rootsInfo,
    gameRoot,

    remote,
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
