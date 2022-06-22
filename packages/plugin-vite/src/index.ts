import type { Plugin } from 'vite'
import { createFilter } from '@rollup/pluginutils'
import type { Options } from './types'
import { resolveOptions } from './core/options'
import { createMarkdown } from './core/markdown'

const advPlugin = (userOptions: Options = {}): Plugin => {
  const options = resolveOptions(userOptions)
  const markdownToVue = createMarkdown(options)

  // allow fill end with '.adv.md' or '.adv'
  const filter = createFilter(
    userOptions.include || /\.adv\.md$/ || /\.adv$/,
    userOptions.exclude,
  )

  return {
    name: 'advjs:plugin',
    enforce: 'pre',

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

    async handleHotUpdate(ctx) {
      if (!filter(ctx.file))
        return

      const defaultRead = ctx.read
      ctx.read = async function () {
        return markdownToVue(ctx.file, await defaultRead())
      }
    },
  }
}

export default advPlugin
