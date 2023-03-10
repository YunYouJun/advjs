import { join } from 'node:path'
import { ensurePrefix, slash } from '@antfu/utils'
import isInstalledGlobally from 'is-installed-globally'
import { sync as resolve } from 'resolve'
import globalDirs from 'global-dirs'

export function toAtFS(path: string) {
  return `/@fs${ensurePrefix('/', slash(path))}`
}

export function resolveImportPath(importName: string, ensure: true): string
export function resolveImportPath(importName: string, ensure?: boolean): string | undefined
export function resolveImportPath(importName: string, ensure = false) {
  try {
    return resolve(importName, {
      preserveSymlinks: false,
    })
  }
  catch {}

  if (isInstalledGlobally) {
    try {
      return require.resolve(join(globalDirs.yarn.packages, importName))
    }
    catch {}

    try {
      return require.resolve(join(globalDirs.npm.packages, importName))
    }
    catch {}
  }

  if (ensure)
    throw new Error(`Failed to resolve package "${importName}"`)

  return undefined
}

export function resolveGlobalImportPath(importName: string): string {
  try {
    return resolve(importName, { preserveSymlinks: false, basedir: __dirname })
  }
  catch {}

  try {
    return require.resolve(join(globalDirs.yarn.packages, importName))
  }
  catch {}

  try {
    return require.resolve(join(globalDirs.npm.packages, importName))
  }
  catch {}

  throw new Error(`Failed to resolve global package "${importName}"`)
}

export function packageExists(name: string) {
  if (resolveImportPath(`${name}/package.json`))
    return true
  return false
}
