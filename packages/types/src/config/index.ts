import type { AssetsManifest } from 'pixi.js'
import type { AdvChapter } from '../game/chapter'
import type { AdvFeatureFlags } from '../types'

export * from './app'
export * from './theme'

export interface AdvConfig {
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
   * @zh 游戏标题
   * @default 'ADV.JS'
   */
  title: string
  /**
   * @zh 游戏描述
   * @default '面向未来与前端的 ADV 文字冒险游戏引擎'
   */
  description: string
  /**
   * @zh 游戏图标
   * @default '/favicon.svg'
   */
  favicon: string
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

  /**
   * all characters appear in the game
   */
  characters: AdvCharacter[]

  bgm: {
    /**
     * auto play first bgm
     */
    autoplay: boolean
    collection: Music[]
  }

  /**
   * @zh 资源配置
   */
  assets: {
    /**
     * @see https://pixijs.com/8.x/examples/assets/bundle
     * @zh 资源清单
     */
    manifest: AssetsManifest
    // /**
    //  * other images
    //  */
    // images: Record<string, string>
    // /**
    //  * background url
    //  */
    // background?: Record<string, string>
    // /**
    //  * audio url
    //  */
    // audios: Record<string, string>
  }

  /**
   * chapters
   */
  chapters: AdvChapter[]

  // -------------------------------------------------
}

export interface Music {
  name: string
  src: string
}

export interface Tachie {
  description?: string
  /**
   * tachie path or url
   * when 2d: img url
   * when 3d: pose json data url
   */
  src: string
  class?: string[]
  style?: Record<string, string>
}

export interface AdvCharacter {
  /**
   * @zh ID 唯一标识
   */
  id: string
  /**
   * @zh 姓名
   */
  name: string
  /**
   * @zh 头像
   */
  avatar?: string
  /**
   * @zh 演员
   */
  actor?: string
  /**
   * @zh 声优
   */
  cv?: string
  /**
   * @zh 别名
   */
  alias?: string | string[]
  /**
   * @zh 立绘们，key为立绘名称
   */
  tachies?: Record<string, Tachie>

  /**
   * 外貌特征
   */
  appearance?: string
  /**
   * 外貌特征提示词
   */
  appearance_prompt?: string
  /**
   * 人物背景
   */
  background?: string
}

/**
 * User Config Type for adv.config.ts
 */
export type UserConfig = Partial<AdvConfig>
