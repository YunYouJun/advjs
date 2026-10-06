import { resolve } from 'node:path'
import process from 'node:process'
import { api } from '@electron-forge/core'

const root = resolve(import.meta.dirname, '..')
await api[process.argv[2]]({ dir: resolve(root, '.build/app'), outDir: resolve(root, 'out') })
