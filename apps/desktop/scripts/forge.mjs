import { resolve } from 'node:path'
import process from 'node:process'
import { api } from '@electron-forge/core'
import { parseDesktopOptions, resolveDesktopTarget } from './config.mjs'

const root = resolve(import.meta.dirname, '..')
const command = process.argv[2]
if (!['package', 'make'].includes(command))
  throw new Error(`Unknown Forge command: ${command}`)
const target = resolveDesktopTarget(parseDesktopOptions(process.argv.slice(3)))
await api[command]({ dir: resolve(root, '.build/app'), outDir: resolve(root, 'out'), ...target })
