import { existsSync, readdirSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'

const pageExtensions = new Set(['.md', '.vue'])

function listPageFiles(root: string): string[] {
  const pagesRoot = join(root, 'pages')
  if (!existsSync(pagesRoot))
    return []

  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory())
        visit(path)
      else if (entry.isFile() && pageExtensions.has(extname(entry.name)))
        files.push(relative(pagesRoot, path).split(sep).join('/'))
    }
  }
  visit(pagesRoot)
  return files
}

/**
 * Build prioritized page folders where a later project/game root shadows the
 * same relative page in the client or theme root.
 */
export function createRoutesFolders(roots: string[]) {
  const filesByRoot = roots.map(listPageFiles)

  return roots.map((root, index) => {
    const overriddenFiles = new Set(filesByRoot.slice(index + 1).flat())
    return {
      src: join(root, 'pages'),
      exclude: [...overriddenFiles].map(file => `**(./)${file}`),
    }
  })
}
