import type { AdvData } from '@advjs/types'
import type { Plugin, ViteDevServer } from 'vite'
import type { ResolvedAdvOptions } from '../options'
import * as parser from '@advjs/parser/fs'
import { notNullish, slash } from '@antfu/utils'
import equal from 'fast-deep-equal'
import { createMarkdown, resolveOptions } from './adv'
import { templates } from './virtual'

interface AdvHmrPayload {
  data: AdvData
}

export function createAdvLoader(
  advOptions: ResolvedAdvOptions,
  vuePlugin: Plugin,
): Plugin[] {
  const advPrefix = '/@advjs/drama'

  const { data, entry } = advOptions
  const options = resolveOptions()
  const transformMarkdown = createMarkdown(options)

  let server: ViteDevServer | undefined

  const filter = (name: string) => {
    return (
      name.endsWith('.adv.md')
      || name.endsWith('.adv')
      || name.startsWith('/@advjs/drama')
    )
  }

  return [
    {
      name: 'advjs:loader',

      configureServer(_server) {
        server = _server
        updateServerWatcher()
      },

      resolveId(id) {
        const virtualPrefixes = [
          '/@advjs/',
          '@advjs/configs/',
        ]
        if (virtualPrefixes.some(prefix => id.startsWith(prefix)))
          return id
        return null
      },

      async load(id) {
        const template = templates.find(t => t.id === id)
        if (template) {
          return {
            code: await template.getContent.call(this, advOptions),
            map: { mappings: '' },
          }
        }

        if (id.startsWith(advPrefix)) {
          return {
            code: data?.raw || '',
            map: {
              mappings: '',
            },
          }
        }
      },

      async handleHotUpdate(ctx) {
        if (!data?.entries?.some(i => slash(i) === ctx.file))
          return

        await ctx.read()

        const { file, server } = ctx
        if (!filter(file))
          return

        // only hot reload .md files as .vue files
        const newData = await parser.load(entry)

        const payload: AdvHmrPayload = {
          data: newData,
        }

        const moduleIds = new Set<string>()

        if (!equal(data.config.features, newData.config.features)) {
          setTimeout(() => {
            ctx.server.ws.send({ type: 'full-reload' })
          }, 1)
        }

        if (!equal(data.config, newData.config))
          moduleIds.add('@advjs/configs/adv')

        moduleIds.add('/@advjs/drama.adv.md')

        Object.assign(data, newData)

        // notify the client to update page data
        server.ws.send({
          type: 'custom',
          event: 'advjs:update',
          data: payload,
        })

        // todo separate scene
        const hmrPages = new Set<number>()
        hmrPages.add(1)

        const vueModules = (
          await Promise.all(
            Array.from(hmrPages).map(async (_page) => {
              const file = entry

              try {
                const { vueSrc } = await transformMarkdown(entry, newData.raw)
                const handleHotUpdate
                      = 'handler' in vuePlugin.handleHotUpdate!
                        ? vuePlugin.handleHotUpdate!.handler
                        : vuePlugin.handleHotUpdate!
                return await handleHotUpdate!({
                  ...ctx,
                  modules: Array.from(
                    ctx.server.moduleGraph.getModulesByFile(file) || [],
                  ),
                  file,
                  read: () => vueSrc,
                })
              }
              catch {}
            }),
          )
        ).flatMap(i => i || [])
        hmrPages.clear()

        const moduleEntries = [
          ...vueModules,
          ...Array.from(moduleIds).map((id) => {
            return server.moduleGraph.getModuleById(id)
          }),
        ]
          .filter(notNullish)
          .filter(i => !i.id?.startsWith('/@id/@vite-icons'))

        return moduleEntries
      },
    },

    {
      name: 'advjs:adv-md:pre',
      enforce: 'pre',
      /**
       * transform adv.md to vue for, next loader
       * @param code
       * @param id
       */
      async transform(code, id) {
        if (!filter(id))
          return

        try {
          const { vueSrc } = await transformMarkdown(entry, code)
          return vueSrc
        }
        catch (e: any) {
          this.error(e)
        }
      },
    },
  ]

  function updateServerWatcher() {
    if (!server)
      return
    server.watcher.add(data?.entries?.map(slash) || [])
  }
}
