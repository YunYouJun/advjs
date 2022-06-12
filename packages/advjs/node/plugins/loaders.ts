import type { Plugin } from 'vite'

export function createAdvLoader(): Plugin[] {
  const advPrefix = '/@advjs/drama/'

  return [
    {
      name: 'advjs:loader',

      resolveId(id) {
        if (id.startsWith(advPrefix) || id.startsWith('/@advjs/'))
          return id
        return null
      },
    },
  ]
}
