import { dirname, join, resolve } from 'path'
import type Vue from '@vitejs/plugin-vue'
import type Icons from 'unplugin-icons/vite'
import type Components from 'unplugin-vue-components/vite'
import type Markdown from 'vite-plugin-md'
import type WindiCSS from 'vite-plugin-windicss'
// import type RemoteAssets from 'vite-plugin-remote-assets'
// import type ServerRef from 'vite-plugin-vue-server-ref'
import type { ArgumentsType } from '@antfu/utils'
import { uniq } from '@antfu/utils'
import type { AdvMarkdown } from '@advjs/types'
import _debug from 'debug'
import { parser } from './parser'
import { packageExists, resolveImportPath } from './utils'
import { getThemeMeta, resolveThemeName } from './themes'

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
  data: AdvMarkdown
  entry: string
  userRoot: string
  cliRoot: string
  clientRoot: string
  theme: string
  themeRoots: string[]
  roots: string[]
  mode: 'dev' | 'build'
  remote?: boolean
}

export interface AdvPluginOptions extends AdvEntryOptions {
  vue?: ArgumentsType<typeof Vue>[0]
  markdown?: ArgumentsType<typeof Markdown>[0]
  components?: ArgumentsType<typeof Components>[0]
  windicss?: ArgumentsType<typeof WindiCSS>[0]
  icons?: ArgumentsType<typeof Icons>[0]
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

export function getThemeRoots(name: string, entry: string) {
  if (!name)
    return []

  // TODO: handle theme inherit
  return [getRoot(name, entry)]
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
  const data = await parser.load(entry)
  const theme = resolveThemeName(options.theme || data.config.theme)

  if (!packageExists(theme)) {
    console.error(`Theme "${theme}" not found, have you installed it?`)
    process.exit(1)
  }

  const clientRoot = getClientRoot()
  const cliRoot = getCLIRoot()
  const themeRoots = getThemeRoots(theme, entry)
  const roots = uniq([clientRoot, ...themeRoots, userRoot])

  if (themeRoots.length) {
    const themeMeta = await getThemeMeta(theme, join(themeRoots[0], 'package.json'))
    data.themeMeta = themeMeta
  }

  debug({
    config: data.config,
    mode,
    entry,
    theme,
    userRoot,
    clientRoot,
    cliRoot,
    themeRoots,
    roots,
    remote,
  })

  return {
    data,
    mode,
    entry,
    theme,
    userRoot,
    clientRoot,
    cliRoot,
    themeRoots,
    roots,
    remote,
  }
}
