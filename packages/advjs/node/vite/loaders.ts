import type { AdvData, ResolvedAdvOptions } from '@advjs/types'
import type { Plugin, ViteDevServer } from 'vite'
import type { AdvServerOptions } from '../options'
import { notNullish } from '@antfu/utils'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import equal from 'fast-deep-equal'
import { createMarkdown, resolveMdOptions } from '../markdown'
import { templates } from '../virtual'
import { templateConfigs } from '../virtual/configs'
import { templateData } from '../virtual/data'
import { templateGames } from '../virtual/game'

interface AdvHmrPayload {
  data: AdvData
}

/**
 * to handle adv.md loader
 */
export function createAdvMdLoader(): Plugin {
  const mdOptions = resolveMdOptions()
  const transformMarkdown = createMarkdown(mdOptions)
  const filter = (name: string) => {
    return (
      name.endsWith('.adv.md')
      || name.endsWith('.adv')
      || name.startsWith('/@advjs/drama')
    )
  }

  return {
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
        const { vueSrc } = await transformMarkdown(id, code)
        return vueSrc
      }
      catch (e: any) {
        this.error(e)
      }
    },
  }
}

/**
 * support adv virtual loader
 * @param advOptions
 * @param serverOptions
 */
export function createAdvVirtualLoader(advOptions: ResolvedAdvOptions, serverOptions: AdvServerOptions): Plugin {
  const advPrefix = '/@advjs/drama'
  const { data } = advOptions

  let server: ViteDevServer | undefined

  function updateServerWatcher() {
    if (!server)
      return
    server.watcher.add(Object.keys(data?.watchFiles || {}))
  }

  return {
    name: 'advjs:loader',

    configureServer(_server) {
      server = _server
      updateServerWatcher()
    },

    resolveId(id) {
      const virtualPrefixes = [
        '/@advjs/',
        '#advjs/',
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
      const { file, server } = ctx

      const start = Date.now()
      const newData = await serverOptions.loadData?.(ctx, {
        [ctx.file]: await ctx.read(),
      })

      /**
       * in adv gameRoot config
       */
      // if (file.startsWith(path.resolve(advOptions.gameRoot, 'games')))

      /**
       * match *.config.ts
       *
       * return undefined to continue other hmr, like vue
       * return [] will stop hmr
       */
      if (!newData)
        return

      const payload: AdvHmrPayload = {
        data: newData,
      }

      const moduleIds = new Set<string>()

      if (!equal(data.config.features, newData.config.features)) {
        setTimeout(() => {
          ctx.server.ws.send({ type: 'full-reload' })
        }, 1)
      }

      if (!equal(data.config, newData.config)) {
        templateConfigs.forEach((config) => {
          moduleIds.add(config.id)
        })
        templateGames.forEach((game) => {
          moduleIds.add(game.id)
        })
        moduleIds.add(templateData.id)
      }

      moduleIds.add('/@advjs/drama.adv.md')

      Object.assign(data, newData)

      // notify the client to update page data
      server.ws.send({
        type: 'custom',
        event: 'advjs:update',
        data: payload,
      })

      // @todo separate scene
      const hmrScenesIndexes = new Set<number>()
      hmrScenesIndexes.add(0)

      const moduleEntries = [
        ...Array.from(moduleIds).map((id) => {
          return server.moduleGraph.getModuleById(id)
        }),
      ]
        .filter(notNullish)
        .filter(i => !i.id?.startsWith('/@id/@vite-icons'))

      updateServerWatcher()

      const duration = Date.now() - start
      consola.success(`🎬 ${colors.blue('[ADV.JS]')} ${colors.green('config updated')} ${colors.dim(file)} ${colors.dim(`${duration}ms`)}`)

      return moduleEntries
    },
  }
}

export function createAdvLoader(
  advOptions: ResolvedAdvOptions,
  serverOptions: AdvServerOptions,
): Plugin[] {
  return [
    createAdvVirtualLoader(advOptions, serverOptions),
    createAdvMdLoader(),
  ]
}
