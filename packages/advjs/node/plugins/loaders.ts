import { join } from 'path'
import type { Plugin } from 'vite'
import { existsSync, readFileSync } from 'fs-extra'
import type { AdvMarkdown } from '@advjs/types'
import * as parser from '@advjs/parser/fs'
import equal from 'fast-deep-equal'
import type { ResolvedAdvOptions } from '../options'
import { toAtFS } from '../utils'

interface AdvHmrPayload {
  data: AdvMarkdown
}

export function createAdvLoader(
  { data, remote, roots, entry }: ResolvedAdvOptions,
): Plugin[] {
  const advPrefix = '/@advjs/drama/'

  /**
   * generate AdvConfig from frontmatter & meta
   * @param data
   * @returns
   */
  function generateConfigs() {
    const config = { ...data.config, remote, features: data.features }
    return `export default ${JSON.stringify(config)}`
  }

  // handle .adv.md in @advjs/plugin-vite
  function generateDrama() {
    const scripts = [
      `import _Drama from "${toAtFS(entry)}"`,
      'export default _Drama',
    ]
    return scripts.join('\n')
  }

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function transformMarkdown(code: string, data: AdvMarkdown) {
    // const imports = [
    //   `import EntryMd from "${entry}"`,
    // ]

    return code
  }

  return [
    {
      name: 'advjs:loader',

      resolveId(id) {
        if (id.startsWith(advPrefix) || id.startsWith('/@advjs/'))
          return id
        return null
      },

      load(id) {
        if (id === '/@advjs/configs')
          return generateConfigs()

        if (id === '/@advjs/drama')
          return generateDrama()

        if (id === '/@advjs/locales')
          return generateLocales(roots)

        // styles
        if (id === '/@advjs/styles')
          return generateUserStyles(roots)
      },

      async handleHotUpdate(ctx) {
        const { file, server } = ctx

        // hot reload .md files as .vue files
        if (file.endsWith('.md')) {
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

          moduleIds.add('/@advjs/drama')

          Object.assign(data, newData)

          // notify the client to update page data
          server.ws.send({
            type: 'custom',
            event: 'advjs:update',
            data: payload,
          })

          const moduleEntries = [
            ...Array.from(moduleIds).map(id => server.moduleGraph.getModuleById(id)),
          ].filter(<T>(item: T): item is NonNullable<T> => !!item)

          return moduleEntries
        }
      },
    },
    {
      name: 'advjs:layout-transform:pre',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.startsWith(advPrefix) || !id.endsWith('.adv.md'))
          return
        return transformMarkdown(code, data)
      },
    },
  ]
}
