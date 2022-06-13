import { join } from 'path'
import { uniq } from '@antfu/utils'
import type { Plugin } from 'vite'
import { existsSync } from 'fs-extra'
import type { ResolvedAdvOptions } from '../options'
import { toAtFS } from '../utils'

export function createAdvLoader(
  { clientRoot, themeRoots, userRoot }: ResolvedAdvOptions,
): Plugin[] {
  const advPrefix = '/@advjs/drama/'

  async function generateUserStyles() {
    const imports: string[] = [
      `import "${toAtFS(join(clientRoot, 'styles/vars.scss'))}"`,
      `import "${toAtFS(join(clientRoot, 'styles/index.scss'))}"`,
    ]
    const roots = uniq([
      ...themeRoots,
      userRoot,
    ])

    for (const root of roots) {
      const styles = [
        join(root, 'styles', 'index.ts'),
        join(root, 'styles', 'index.js'),
        join(root, 'styles', 'index.css'),
        join(root, 'styles', 'index.scss'),
        join(root, 'styles.css'),
        join(root, 'style.css'),
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

      load(id) {
        // styles
        if (id === '/@advjs/styles')
          return generateUserStyles()
      },
    },
  ]
}
