import fs from 'node:fs'
import { resolve } from 'node:path'
import { rimrafSync } from 'rimraf'
import { cleanDirs } from './config'
import { clean } from './utils/clean'

const packagesFolder = resolve('packages')

async function run() {
  cleanDirs.forEach((dir) => {
    rimrafSync(dir)
  })

  const dirs = fs.readdirSync('packages')
  const targets = dirs.filter(dir => !dir.startsWith('.') && fs.statSync(
    resolve(packagesFolder, dir),
  ).isDirectory())
  targets.forEach(target => clean(target, cleanDirs))
}

run()
