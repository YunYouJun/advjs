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
