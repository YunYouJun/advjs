export interface Character {
  name: string
  active?: boolean
  class?: string[]
  style?: any
  tachies?: any
  status: string
}

export const characters: Character[] = [
  {
    name: '我',
    status: 'default',
    tachies: {
      default: '/img/characters/she/she.png',
    },
    active: false,
    style: {
      transform: 'scale(1.2)',
    },
  },
  {
    name: '他',
    status: 'default',
    tachies: {
      default: '/img/characters/he/he.png',
      笑: '/img/characters/he/he-smile.png',
    },
    class: ['-translate-y-20', 'scale-110'],
    active: false,
  },
]
