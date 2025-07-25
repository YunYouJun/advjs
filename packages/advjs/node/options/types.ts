import type { AdvData } from '@advjs/types'
// import type RemoteAssets from 'vite-plugin-remote-assets'
// import type ServerRef from 'vite-plugin-vue-server-ref'
import type { ArgumentsType } from '@antfu/utils'
import type Vue from '@vitejs/plugin-vue'
import type { VitePluginConfig as UnoCSSConfig } from 'unocss/vite'
import type Components from 'unplugin-vue-components/vite'
import type Markdown from 'unplugin-vue-markdown'
import type { ConfigEnv, HmrContext } from 'vite'

export interface AdvEntryOptions {
  /**
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

  remote?: boolean

  /**
   * Root path
   *
   * @default process.cwd()
   */
  userRoot?: string
}

/**
 * adv build options
 */
export interface AdvBaseBuildOptions extends AdvEntryOptions {
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

/**
 * 仅当启用 `pominis` 适配器时有效
 */
export interface PominisBuildOptions extends AdvBaseBuildOptions {
  adapter: 'pominis'
  /**
   * story id
   * @example '6c91aa92-3f4a-462e-89e8-05040602e768'
   */
  storyId: string
}

export type AdvBuildOptions = AdvBaseBuildOptions | PominisBuildOptions

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

export interface ResolvedAdvOptions extends RootsInfo {
  /**
   * plugin or app
   * - `plugin`: used in advjs plugin mode, like `vite-plugin-adv`
   * - `app`: used in advjs app mode, 通过 cli 独立使用
   *
   * @default 'app'
   */
  env: 'plugin' | 'app'

  mode: ConfigEnv['mode']
  /**
   * 都放在 data 下以便一起处理 HMR
   */
  data: AdvData
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

  /**
   * theme
   */
  theme: string
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
