import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'

export * from './types'

// shim
export const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export const componentsDir = resolve(_dirname, '../components')
