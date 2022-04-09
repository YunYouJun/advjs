import { createUnplugin } from 'unplugin'
import { createFilter } from '@rollup/pluginutils'
import type { Options } from './types'
import { resolveOptions } from './core/options'
import { createMarkdown } from './core/markdown'

export default createUnplugin<Options>((userOptions: Options = {}) => {
  const options = resolveOptions(userOptions)
  const markdownToVue = createMarkdown(options)

  // allow fill end with '.adv.md' or '.adv'
  const filter = createFilter(
    userOptions.include || /\.adv\.md$/ || /\.adv$/,
    userOptions.exclude,
  )

  return {
    name: 'unplugin-adv',
    enforce: 'pre',

    transformInclude(id) {
      return filter(id)
    },

    transform(raw, id) {
      if (!filter(id))
        return
      try {
        return markdownToVue(id, raw)
      }
      catch (e: any) {
        this.error(e)
      }
    },

    vite: {
      async handleHotUpdate(ctx) {
        if (!filter(ctx.file))
          return

        const defaultRead = ctx.read
        ctx.read = async function() {
          return markdownToVue(ctx.file, await defaultRead())
        }
      },
    },
  }
})
