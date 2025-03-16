import type { AdvFeatureFlags } from '../types'

/**
 * 游戏应用级别的配置
 *
 * - 游戏内容位于 `game.config.ts` 中
 */
export interface AdvConfig {
  /**
   * adv root
   *
   * - /<rootDir>/setups
   * - /<rootDir>/locales
   * - /<rootDir>/components
   * - /<rootDir>/layouts
   * - /<rootDir>/pages
   * - /<rootDir>/styles
   */
  root?: string

  /**
   * 游戏解析格式
   *
   * - fountain(markdown): 以 Markdown 文本编辑为核心体验的解析方式
   * - flow(json): 以节点编辑器为开发工作流的节点解析方式
   *
   * @default 'fountain'
   */
  format: 'fountain' | 'flow'

  remote?: boolean

  /**
   * @zh UI 主题
   * Theme to use for the advjs
   * @default 'default'
   */
  theme: string
  /**
   * @zh 主题配置
   * @default {}
   */
  themeConfig: any

  /**
   * @zh 特性开关
   */
  features: AdvFeatureFlags

  // client
  /**
   * @zh 画面宽高比
   * Aspect ratio for game
   * should be like `16/9` or `1:1`
   *
   * @default '16/9'
   */
  aspectRatio: number
  /**
   * The actual width for canvas.
   * unit in px.
   *
   * @default '1920'
   */
  canvasWidth: number
  /**
   * Controls whether texts in slides are selectable
   *
   * @default false when debug is true
   */
  selectable: boolean

  /**
   * global game config
   * -------------------------------------------------
   */

  pages: {
    /**
     * Start Page
     */
    start: {
      /**
       * Path or URL
       * @zh 背景
       */
      bg: string
      /**
       * Path or URL
       * @zh 暗色模式背景
       */
      darkBg?: string
    }
  }

  /**
   * 是否显示人物头像
   * @default false
   */
  showCharacterAvatar: boolean

  cdn: {
    enable: boolean
    prefix?: string
  }

  // -------------------------------------------------
}

/**
 * User Config Type for adv.config.ts
 */
export type UserConfig = Partial<AdvConfig>
