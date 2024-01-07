import { resolve } from 'node:path'
import fs from 'node:fs'
import { rimrafSync } from 'rimraf'

const cleanDirs = [
  // 'node_modules',
  'dist',
]

const packagesFolder = resolve('packages')

function clean(target: string) {
  const folder = `packages/${target}`

  cleanDirs.forEach((dir) => {
    rimrafSync(resolve(folder, dir))
  })
}

async function run() {
  cleanDirs.forEach((dir) => {
    rimrafSync(dir)
  })

  const dirs = fs.readdirSync('packages')
  const targets = dirs.filter(dir => !dir.startsWith('.') && fs.statSync(
    resolve(packagesFolder, dir),
  ).isDirectory())
  targets.forEach(target => clean(target))
}

run()
