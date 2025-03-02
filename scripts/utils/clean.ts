import { resolve } from 'node:path'
import { rimrafSync } from 'rimraf'

/**
 * 清楚指定目录
 */
export function clean(target: string, cleanDirs: string[]) {
  const folder = `packages/${target}`

  cleanDirs.forEach((dir) => {
    rimrafSync(resolve(folder, dir))
  })
}
