export * from './client'

export interface Tachie {
  /**
   * only one
   * @example smile
   */
  id: string
  /**
   * @example 微笑
   */
  name?: string
  description?: string
  /**
   * tachie path or url
   * when 2d: img url
   * when 3d: pose json data url
   */
  src: string
}

export interface Character {
  /**
   * @description:zh-CN 姓名
   */
  name: string
  /**
   * @description:zh-CN 头像
   */
  avatar: string
  /**
   * @description:zh-CN 别名
   */
  alias: string | string[]
  /**
   * @description:zh-CN 立绘们
   */
  tachies: Tachie[]
}

/**
 * Global Game Config
 */
export interface GameConfig {
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
}

/**
 * User Config Type for adv.config.ts
 */
export type UserGameConfig = Partial<GameConfig>
