export * from './client'

export interface Character {
  /**
   * 姓名
   */
  name: string
  /**
   * 头像
   */
  avatar: string
  /**
   * 别名
   */
  alias: string | string[]
}

export interface GameConfig {
  pages: {
    // 开始页面
    start: {
      /**
       * 背景
       */
      bg: string
      /**
       * 暗色模式
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
  characters: Character[]
}

export type UserGameConfig = Partial<GameConfig>
