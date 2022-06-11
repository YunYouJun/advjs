import type { Plugin } from 'vite'

function generateScripts() {}

export function createAdvPlugin(): Plugin {
  const advPrefix = '/@advjs'

  return {
    name: '',

    load(id) {
      if (id === '/@advjs/md-scripts')
        return generateScripts()

      if (id.startsWith(advPrefix))
        return ''
    },
  }
}
