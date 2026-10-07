import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'
import { assertDesktopVersion, resolveDesktopTarget } from './config.mjs'
import { stageRuntime } from './runtime.mjs'

const root = resolve(import.meta.dirname, '..')
const stage = resolve(root, '.build')
const runtime = resolve(stage, 'runtime')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const version = assertDesktopVersion(process.env.ADVJS_DESKTOP_VERSION || pkg.version)
const require = createRequire(import.meta.url)
const electronVersion = require('electron/package.json').version

resolveDesktopTarget()
await rm(stage, { recursive: true, force: true })
const result = await stageRuntime({ name: 'advjs', from: root, destination: runtime })
await cp(resolve(root, 'dist'), resolve(runtime, 'dist'), { recursive: true })
await mkdir(resolve(stage, 'app'), { recursive: true })
await cp(resolve(root, 'dist'), resolve(stage, 'app/dist'), { recursive: true })
await writeFile(resolve(stage, 'app/package.json'), JSON.stringify({
  name: 'advjs-desktop',
  productName: 'ADV.JS Editor',
  version,
  description: pkg.description,
  author: pkg.author,
  license: pkg.license,
  main: 'dist/main.mjs',
  type: 'module',
  devDependencies: { electron: electronVersion },
  config: { forge: resolve(root, 'forge.config.cjs') },
}, null, 2))
process.stdout.write(`Staged ${result.packages} runtime packages (${result.copies} copies), version ${version}; all dependencies are portable.\n`)
