import { resolve } from 'path'
import rimraf from 'rimraf'

function clean(target: string) {
  const folder = `packages/${target}`
  rimraf(resolve(folder, 'node_modules'), () => null)
}

async function run() {
  rimraf('node_modules', () => null)

  const targets = [
    'advjs',
    'client',

    'plugin-babylon',
    'plugin-vite',

    'vrm',
    'editor',
  ]
  targets.forEach(target => clean(target))
}

run()
