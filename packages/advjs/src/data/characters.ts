/**
 * 人物完整信息
 */
export interface CharacterInfo {
  name: string
  active?: boolean
  class?: string[]
  style?: any
  tachies?: any
  /**
   * 初始状态
   */
  initStatus: string
}

export const characters: CharacterInfo[] = [
  {
    name: '我',
    initStatus: 'default',
    tachies: {
      default: '/img/characters/she/she.png',
    },
    style: {
      transform: 'scale(1.2)',
    },
  },
  {
    name: '他',
    initStatus: 'default',
    tachies: {
      default: '/img/characters/he/he.png',
      笑: '/img/characters/he/he-smile.png',
    },
    class: ['scale-120'],
  },
]
