import path from 'node:path'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { cleanDir } from './utils/clean'
import { getAllPackages } from './utils/monorepo'

const cleanChildDirs = [
  'dist',
  // 'node_modules',
]

async function run() {
  const dirs = getAllPackages()
  dirs.forEach((dir) => {
    cleanChildDirs.forEach((childDir) => {
      const dirPath = path.resolve(dir, childDir)
      cleanDir(dirPath)
      consola.success(`Cleaned Dir: ${colors.cyan(dirPath)}`)
    })
  })
}

run()
