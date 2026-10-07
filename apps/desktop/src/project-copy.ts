import { cp, mkdir, readdir, realpath, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'

export function contains(root: string, path: string) {
  const part = relative(root, path)
  return !isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`)
}
export const ignoredProjectPaths = new Set(['.git', 'node_modules', '.nuxt', '.output', '.build', '.advjs', 'dist', 'coverage', '.env'])
export function ignoredProjectPath(path: string) {
  return path.split(/[\\/]/u).some(part => ignoredProjectPaths.has(part) || part.startsWith('.env.'))
}

/** Read the author's files into a disposable mirror; never write the source. */
export function createProjectMirror(root: string, destination: string) {
  let previous = new Map<string, string>()
  return {
    async sync() {
      const canonical = await realpath(root)
      const next = new Map<string, string>()
      async function scan(directory: string, prefix = '', ancestors: string[] = []) {
        const target = await realpath(directory)
        if (!contains(canonical, target) || ancestors.includes(target))
          throw new Error(`项目符号链接越界或循环：${prefix}`)
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(prefix, entry.name)
          if (ignoredProjectPath(path))
            continue
          const source = join(canonical, path)
          const resolved = await realpath(source)
          if (!contains(canonical, resolved))
            throw new Error(`项目符号链接越界：${path}`)
          const info = await stat(source)
          if (info.isDirectory()) {
            await scan(source, path, [...ancestors, target])
          }
          else if (info.isFile()) {
            const identity = `${info.size}:${info.mtimeMs}:${info.ctimeMs}`
            next.set(path, identity)
            if (previous.get(path) !== identity) {
              const output = join(destination, path)
              await mkdir(dirname(output), { recursive: true })
              await cp(source, output, { dereference: true })
            }
          }
        }
      }
      await scan(canonical)
      for (const path of previous.keys()) {
        if (!next.has(path))
          await rm(join(destination, path), { force: true })
      }
      previous = next
    },
  }
}
