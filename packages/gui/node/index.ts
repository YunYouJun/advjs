import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const pkgRoot = dirname(require.resolve('@advjs/gui/package.json'))
export const clientRoot = resolve(pkgRoot, 'client')
export const componentsDir = resolve(clientRoot, 'components')
