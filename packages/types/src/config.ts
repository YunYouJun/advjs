import type { AdvFeatureFlags } from './types'

export interface AdvConfig {
  remote?: boolean

  /**
   * @default 'ADV.JS'
   */
  title: string
  /**
   * @default '/favicon.svg'
   */
  favicon: string
  /**
   * Theme to use for the advjs
   * @default 'default'
   */
  theme: string
  /**
   * @default {}
   */
  themeConfig: any

  features: AdvFeatureFlags

  // client
  /**
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
   * @default '980'
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
       * @description:zh-CN 背景
       */
      bg: string
      /**
       * Path or URL
       * @description:zh-CN 暗色模式背景
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
  characters: Character[]

  bgm: {
    /**
     * auto play first bgm
     */
    autoplay: boolean
    collection: Music[]
  }

  assets: {
    /**
     * other images
     */
    images: Record<string, string>
    /**
     * background url
     */
    background: Record<string, string>
    /**
     * audio url
     */
    audio: Record<string, string>
  }

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

export interface Character {
  /**
   * @description:zh-CN 姓名
   */
  name: string
  /**
   * @description:zh-CN 头像
   */
  avatar?: string
  /**
   * @description:zh-CN 别名
   */
  alias?: string | string[]
  /**
   * @description:zh-CN 立绘们，key为立绘名称
   */
  tachies: Record<string, Tachie>
}

/**
 * User Config Type for adv.config.ts
 */
export type UserConfig = Partial<AdvConfig>
