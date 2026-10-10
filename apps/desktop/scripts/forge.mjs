import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseDesktopOptions, resolveDesktopTarget } from './config.mjs'
import progress from './progress.cjs'

const root = resolve(import.meta.dirname, '..')

export async function runForge(command, args = [], dependencies = {}) {
  if (!['package', 'make'].includes(command))
    throw new Error(`Unknown Forge command: ${command}`)
  const target = resolveDesktopTarget(parseDesktopOptions(args), dependencies.host || process)
  const report = dependencies.report || progress.reportDesktopProgress
  const environment = dependencies.environment || process.env
  // Windows-only Packager diagnostics distinguish resource editing from the
  // final move, which have no separate Forge hooks. Configure before import.
  if (target.platform === 'win32' && environment.CI)
    environment.DEBUG = [environment.DEBUG, 'electron-packager'].filter(Boolean).join(',')
  report('loading-forge', { command, ...target })
  const { api } = await (dependencies.loadForge || (() => import('@electron-forge/core')))()
  report('starting-forge', { command, ...target })
  await api[command]({ dir: resolve(root, '.build/app'), outDir: resolve(root, 'out'), interactive: false, ...target })
  report('completed-forge', { command, ...target })
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await runForge(process.argv[2], process.argv.slice(3))
