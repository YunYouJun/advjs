import { createRequire } from 'node:module'
import { join } from 'node:path'
import { ensurePrefix, slash } from '@antfu/utils'
import globalDirs from 'global-directory'
import isInstalledGlobally from 'is-installed-globally'

export function toAtFS(path: string) {
  return `/@fs${ensurePrefix('/', slash(path))}`
}

const require = createRequire(import.meta.url)

export async function resolveImportPath(importName: string, ensure: true): Promise<string>
export async function resolveImportPath(importName: string, ensure?: boolean): Promise<string | undefined>
export async function resolveImportPath(importName: string, ensure = false) {
  try {
    return require.resolve(importName)
  }
  catch (error) {
    console.error(error)
  }

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

export async function resolveGlobalImportPath(importName: string): Promise<string> {
  try {
    return require.resolve(importName)
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

export async function packageExists(name: string) {
  if (await resolveImportPath(`${name}/package.json`))
    return true
  return false
}
