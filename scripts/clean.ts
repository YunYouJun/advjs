import { resolve } from 'node:path'
import { rimrafSync } from 'rimraf'

const cleanDirs = [
  'node_modules',
  'dist',
]

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

  const targets = [
    'advjs',
    'client',

    // plugins
    'plugin-babylon',

    // editor
    'vrm',
    'editor',
  ]
  targets.forEach(target => clean(target))
}

run()
