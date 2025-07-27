import type { AdvData, MakeRequired, ResolvedAdvPlugin } from '@advjs/types'
import type { ConfigEnv, LogLevel } from 'vite'

/**
 * adv build options
 */
export interface AdvBuildOptions {
  /**
   * 是否单文件打包
   * @default false
   */
  singlefile?: boolean
  /**
   * Output directory
   * @default 'dist'
   */
  outDir?: string
}

export interface AdvBaseEntryOptions {
  /**
   * plugin or app
   * - `plugin`: used in advjs plugin mode, like `vite-plugin-adv`
   * - `app`: used in advjs app mode, 通过 cli 独立使用
   *
   * @default 'app'
   */
  env?: 'plugin' | 'app'
  /**
   * Public base path
   * @default '/'
   */
  base?: string
  /**
   * Theme id
   */
  theme?: string
  /**
   * remote
   */
  remote?: boolean
  /**
   * Root path
   *
   * @default process.cwd()
   */
  userRoot?: string
  /**
   * log level
   */
  log?: LogLevel
}

export interface AdvDevOptions {
  root?: string
  /**
   * open browser
   * @default false
   */
  open?: boolean
  /**
   * port
   */
  port?: number
  force?: boolean
}

/**
 * adv entry
 *
 * @example
 *
 * ```bash
 * adv build --singlefile
 * ```
 */
export type AdvEntryOptions = AdvBaseEntryOptions & AdvBuildOptions & AdvDevOptions

export interface RootsInfo {
  /**
   * root path
   */
  userRoot: string
  cliRoot: string
  clientRoot: string
  themeRoot: string
  /**
   * game root path
   * @default 'adv'
   */
  gameRoot: string
  /**
   * '.adv' directory
   */
  tempRoot: string
  /**
   * user workspace root
   * monorepo root like pnpm workspace
   */
  userWorkspaceRoot: string
}

export interface BaseResolvedAdvOptions {
  mode: ConfigEnv['mode']
  /**
   * 都放在 data 下以便一起处理 HMR
   */
  data: AdvData
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
  /**
   * Theme package name
   */
  themePkgName: string

  /**
   * build options
   *
   * `adv build --singlefile`
   * will set `build.singlefile` to true
   */
  build: AdvBuildOptions

  /**
   * adv plugins
   */
  plugins: ResolvedAdvPlugin[]
}

export type ResolvedAdvOptions = MakeRequired<AdvEntryOptions, 'env' | 'theme'> & RootsInfo & BaseResolvedAdvOptions
