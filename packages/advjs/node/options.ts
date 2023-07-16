import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import type Vue from '@vitejs/plugin-vue'
import type Components from 'unplugin-vue-components/vite'
import type Markdown from 'vite-plugin-vue-markdown'
import type UnoCSS from 'unocss/vite'

// import type RemoteAssets from 'vite-plugin-remote-assets'
// import type ServerRef from 'vite-plugin-vue-server-ref'
import type { ArgumentsType } from '@antfu/utils'
import { uniq } from '@antfu/utils'
import type { AdvConfig, AdvMarkdown } from '@advjs/types'
import _debug from 'debug'
import { parser } from './parser'
import { packageExists, resolveImportPath } from './utils'
import { getThemeMeta, resolveThemeName } from './themes'
import { resolveAdvConfig } from './config'

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

export type AdvUserConfig = Partial<AdvConfig>

export interface ResolvedAdvOptions {
  data: AdvMarkdown
  entry: string
  userRoot: string
  cliRoot: string
  clientRoot: string
  themeRoot: string
  theme: string
  roots: string[]
  mode: 'dev' | 'build'
  remote?: boolean

  /**
   * Adv Config
   */
  config: AdvUserConfig
  configFile: string
}

export interface AdvPluginOptions extends AdvEntryOptions {
  vue?: ArgumentsType<typeof Vue>[0]
  markdown?: ArgumentsType<typeof Markdown>[0]
  components?: ArgumentsType<typeof Components>[0]
  unocss?: ArgumentsType<typeof UnoCSS>[0]
  // remoteAssets?: ArgumentsType<typeof RemoteAssets>[0]
  // serverRef?: ArgumentsType<typeof ServerRef>[0]
}

export interface AdvServerOptions {
  onDataReload?: (newData: AdvMarkdown, data: AdvMarkdown) => void
}

export function getClientRoot() {
  return dirname(resolveImportPath('@advjs/client/package.json', true))
}

export function getCLIRoot() {
  return resolve(__dirname, '..')
}

export function isPath(name: string) {
  return name.startsWith('/') || /^\.\.?[\/\\]/.test(name)
}

export function getThemeRoot(name: string, entry: string) {
  if (!name)
    return

  // TODO: handle theme inherit
  return getRoot(name, entry)
}

export function getRoot(name: string, entry: string) {
  if (isPath(name))
    return resolve(dirname(entry), name)
  return dirname(resolveImportPath(`${name}/package.json`, true))
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
  // avoid type error, type see packages/parser/fs
  const data = (parser as any).load(entry)

  const theme = resolveThemeName(options.theme || data.config.theme)

  if (!packageExists(theme)) {
    console.error(`Theme "${theme}" not found, have you installed it?`)
    process.exit(1)
  }

  const clientRoot = getClientRoot()
  const cliRoot = getCLIRoot()
  const themeRoot = getThemeRoot(theme, entry)

  if (themeRoot) {
    const themeMeta = await getThemeMeta(theme, join(themeRoot, 'package.json'))
    data.themeMeta = themeMeta
  }
  else {
    throw new Error('[ADV] Can not find your ADV.JS Theme')
  }

  const roots = uniq([clientRoot, themeRoot, userRoot])

  const { config = {}, configFile = '' } = await resolveAdvConfig()

  const advOptions: ResolvedAdvOptions = {
    data,
    mode,
    entry,
    theme,
    userRoot,
    clientRoot,
    cliRoot,
    themeRoot,
    roots,
    remote,

    config: config || {},
    configFile,
  }

  debug(advOptions)
  return advOptions
}
