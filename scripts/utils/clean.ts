import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 清楚指定目录
 */
export function clean(target: string, cleanDirs: string[]) {
  const folder = `packages/${target}`

  cleanDirs.forEach((dir) => {
    rmSync(resolve(folder, dir), { recursive: true, force: true })
  })
}

export function cleanDir(dir: string) {
  rmSync(resolve(dir), { recursive: true, force: true })
}
