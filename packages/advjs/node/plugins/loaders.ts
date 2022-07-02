import { join } from 'path'
import type { Plugin } from 'vite'
import { existsSync, readFileSync } from 'fs-extra'
import type { AdvMarkdown } from '@advjs/types'
import * as parser from '@advjs/parser/fs'
import equal from 'fast-deep-equal'
import type { LoadResult } from 'rollup'
import type { ResolvedAdvOptions } from '../options'
import { toAtFS } from '../utils'
import { createMarkdown, resolveOptions } from './adv'

interface AdvHmrPayload {
  data: AdvMarkdown
}

export function createAdvLoader(
  { data, remote, roots, entry }: ResolvedAdvOptions,
  vuePlugin: Plugin,
): Plugin[] {
  const advPrefix = '/@advjs/drama'

  const options = resolveOptions()
  const markdownToVue = createMarkdown(options)

  const transformMarkdown = (id: string, raw: string) => {
    return markdownToVue(id, raw)
  }

  const filter = (name: string) => {
    return name.endsWith('.adv.md') || name.startsWith('/@advjs/drama')
  }

  /**
   * generate AdvConfig from frontmatter & meta
   * @param data
   * @returns
   */
  function generateConfigs() {
    const config = { ...data.config, remote, features: data.features }
    return `export default ${JSON.stringify(config)}`
  }

  // handle .adv.md in .adv.md
  // function generateDrama() {
  //   const scripts = [
  //     `import _Drama from "${toAtFS(entry)}"`,
  //     'export default _Drama',
  //   ]
  //   return scripts.join('\n')
  // }

  function generateLocales(roots: string[]) {
    const imports: string[] = [
      'const messages = { "zh-CN": {}, en: {} }',
    ]
    const languages = ['zh-CN', 'en']

    roots.forEach((root, i) => {
      languages.forEach((lang) => {
        const langYml = `${root}/locales/${lang}.yml`
        // file not null
        if (existsSync(langYml) && readFileSync(langYml, 'utf-8')) {
          const varName = lang.replace('-', '') + i
          imports.push(`import ${varName} from "${toAtFS(langYml)}"`)
          imports.push(`Object.assign(messages['${lang}'], ${varName})`)
        }
      })
    })

    imports.push('export default messages')
    return imports.join('\n')
  }

  async function generateUserStyles(roots: string[]) {
    const imports = []

    for (const root of roots) {
      const styles = [
        join(root, 'styles', 'index.ts'),
        join(root, 'styles', 'index.js'),
        join(root, 'styles', 'index.css'),
        join(root, 'styles', 'index.scss'),
        join(root, 'styles', 'css-vars.css'),
        join(root, 'styles', 'css-vars.scss'),
      ]

      for (const style of styles) {
        if (existsSync(style)) {
          imports.push(`import "${toAtFS(style)}"`)
          continue
        }
      }
    }

    return imports.join('\n')
  }

  return [
    {
      name: 'advjs:loader',

      resolveId(id) {
        if (id.startsWith(advPrefix) || id.startsWith('/@advjs/'))
          return id
        return null
      },

      load(id): LoadResult | Promise<LoadResult> {
        if (id === '/@advjs/configs')
          return generateConfigs()

        if (id === '/@advjs/locales')
          return generateLocales(roots)

        // styles
        if (id === '/@advjs/styles')
          return generateUserStyles(roots)

        // if (id === '/@advjs/drama')
        // return generateDrama()
        if (id.startsWith(advPrefix)) {
          return {
            code: data.raw,
            map: {
              mappings: '',
            },
          }
        }
      },

      async handleHotUpdate(ctx) {
        const { file, server } = ctx

        // hot reload .md files as .vue files
        if (filter(file)) {
          const newData = parser.load(entry, data.themeMeta)

          const payload: AdvHmrPayload = {
            data: newData,
          }

          const moduleIds = new Set<string>()

          if (!equal(data.features, newData.features)) {
            setTimeout(() => {
              ctx.server.ws.send({ type: 'full-reload' })
            }, 1)
          }

          if (!equal(data.config, newData.config))
            moduleIds.add('/@advjs/configs')

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

          const vueModules = ([
            await (async () => {
              const file = entry

              try {
                const md = await markdownToVue(entry, newData.raw)

                return await vuePlugin.handleHotUpdate!({
                  ...ctx,
                  modules: Array.from(ctx.server.moduleGraph.getModulesByFile(file) || []),
                  file,
                  read() { return md },
                })
              }
              catch {}
            })(),
          ]).flatMap(i => i || [])

          const moduleEntries = [
            ...vueModules,
            ...Array.from(moduleIds).map((id) => {
              return server.moduleGraph.getModuleById(id)
            }),
          ].filter(<T>(item: T): item is NonNullable<T> => !!item)

          return moduleEntries
        }
      },
    },
    {
      name: 'advjs:layout-transform:pre',
      enforce: 'pre',
      transform(code, id) {
        if (!filter(id))
          return

        return transformMarkdown(entry, code)
      },
    },
  ]
}
