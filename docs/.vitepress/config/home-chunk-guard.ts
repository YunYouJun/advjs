import type { Plugin } from 'vite'

/**
 * Modules that belong to the home page's AI mode. They load on the first click of the AI toggle,
 * so none of them may sit in the app entry or the home page's chunks, or in anything those
 * import statically.
 */
const FORBIDDEN = [
  '/packages/ai/',
  '/packages/parser/src/',
  '/packages/core/src/project/',
  '/components/home/ai/',
  '/shiki/dist/engine-javascript',
]

const HOME_PAGES = [/\/docs\/index\.md$/, /\/docs\/en\/index\.md$/]

/** Fails the client build when AI mode leaks into the home page's first load. */
export function homeChunkGuard(): Plugin {
  return {
    name: 'advjs-docs:home-chunk-guard',
    apply: 'build',
    generateBundle(_, bundle) {
      if (this.environment && this.environment.name !== 'client')
        return
      const chunks = Object.values(bundle).filter(output => output.type === 'chunk')
      const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
      // VitePress builds the app and every page as entries; the roots are the app and the home pages.
      type Chunk = typeof chunks[number]
      const isHome = (chunk: Chunk) => !!chunk.facadeModuleId && HOME_PAGES.some(page => page.test(chunk.facadeModuleId!))
      const isApp = (chunk: Chunk) => chunk.isEntry && !!chunk.facadeModuleId?.includes('/vitepress/dist/client/app/')
      const roots = chunks.filter(chunk => isHome(chunk) || isApp(chunk))
      if (!roots.some(isHome) || !roots.some(isApp))
        this.error('home-chunk-guard: could not find the app entry and the home page chunks')

      const seen = new Set<string>()
      const queue = roots.map(chunk => chunk.fileName)
      const violations: string[] = []
      while (queue.length) {
        const name = queue.pop()!
        if (seen.has(name))
          continue
        seen.add(name)
        const chunk = byName.get(name)
        if (!chunk)
          continue
        for (const id of chunk.moduleIds) {
          if (FORBIDDEN.some(pattern => id.includes(pattern)))
            violations.push(`${name}: ${id}`)
        }
        queue.push(...chunk.imports)
      }
      if (violations.length)
        this.error(`home-chunk-guard: AI mode modules are in the home page's first load:\n${violations.join('\n')}`)
    },
  }
}
