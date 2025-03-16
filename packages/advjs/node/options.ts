import type { AdvData } from '@advjs/types'
// import type RemoteAssets from 'vite-plugin-remote-assets'
// import type ServerRef from 'vite-plugin-vue-server-ref'
import type { ArgumentsType } from '@antfu/utils'
import type Vue from '@vitejs/plugin-vue'
import type { VitePluginConfig as UnoCSSConfig } from 'unocss/vite'
import type Components from 'unplugin-vue-components/vite'
import type Markdown from 'unplugin-vue-markdown'
import { dirname, join, resolve } from 'node:path'

import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { load } from '@advjs/parser/fs'
import { uniq } from '@antfu/utils'
import _debug from 'debug'
import fs from 'fs-extra'
import { loadAdvConfigs } from './config'
import { packageExists, resolveImportPath } from './resolver'
import { getThemeMeta, resolveThemeName } from './themes'

import { getAdvThemeRoot } from './utils/root'

const __dirname = dirname(fileURLToPath(import.meta.url))

const debug = _debug('adv:options')

export interface AdvEntryOptions {
  /**
   * Markdown entry
   *
   * @default 'index.adv.md'
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

export interface ResolvedAdvOptions {
  /**
   * 都放在 data 下以便一起处理 HMR
   */
  data: AdvData
  entry: string

  /**
   * root path
   */
  userRoot: string
  cliRoot: string
  clientRoot: string
  themeRoot: string
  roots: string[]

  mode: 'dev' | 'build'
  remote?: boolean
  /**
   * Base URL in dev or build mode
   */
  base?: string
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
  loadData?: (loadedSource: Record<string, string>) => Promise<AdvData | false>
}

export async function getClientRoot() {
  const importPath = await resolveImportPath('@advjs/client/package.json', true)
  return dirname(importPath)
}

export function getCLIRoot() {
  return resolve(__dirname, '..')
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
  const {
    entry,
    userRoot,
  } = getUserRoot(options)

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

  let data: AdvData = {} as AdvData
  if (config.format === 'fountain') {
    // avoid type error, type see packages/parser/fs
    data = await load(entry)
  }

  data.config = config
  data.configFile = configFile
  data.gameConfig = gameConfig
  data.gameConfigFile = gameConfigFile
  data.themeConfig = themeConfig
  data.themeConfigFile = themeConfigFile

  const theme = await resolveThemeName(options.theme)
  /**
   * load theme config
   */

  if (!await packageExists(theme)) {
    console.error(`Theme "${theme}" not found, have you installed it?`)
    process.exit(1)
  }

  const cliRoot = getCLIRoot()
  const clientRoot = await getClientRoot()
  const themeRoot = await getAdvThemeRoot(theme)

  const pkg = await fs.readJSON(`${themeRoot}/package.json`)
  themeConfig.pkg = pkg

  const roots = uniq([
    clientRoot,
    themeRoot,
    userRoot,
    resolve(userRoot, data.config.root || ''),
  ])

  const advOptions: ResolvedAdvOptions = {
    data,
    mode,
    entry,

    userRoot,
    clientRoot,
    cliRoot,
    themeRoot,

    roots,
    remote,
  }

  if (themeRoot) {
    const themeMeta = await getThemeMeta(theme, join(themeRoot, 'package.json'))
    data.themeMeta = themeMeta
  }
  else {
    throw new Error('[ADV] Can not find your ADV.JS Theme')
  }

  debug(advOptions)
  return advOptions
}
