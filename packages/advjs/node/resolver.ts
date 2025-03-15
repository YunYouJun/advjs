import * as fs from 'node:fs'

import { dirname, join } from 'node:path'
import { ensurePrefix, slash } from '@antfu/utils'
import globalDirs from 'global-directory'
import { resolvePath } from 'mlly'
import { resolveGlobal } from 'resolve-global'
import { findDepPkgJsonPath } from 'vitefu'

export const isInstalledGlobally: { value?: boolean } = {}

export function toAtFS(path: string) {
  return `/@fs${ensurePrefix('/', slash(path))}`
}

/**
 * Resolve path for import url on Vite client side
 */
export async function resolveImportUrl(id: string) {
  return toAtFS(await resolveImportPath(id, true))
}

/**
 * Find the actual path of the import. If advjs is installed globally, it will also search globally.
 */
export async function resolveImportPath(importName: string, ensure: true): Promise<string>
export async function resolveImportPath(importName: string, ensure?: boolean): Promise<string | undefined>
export async function resolveImportPath(importName: string, ensure = false) {
  try {
    return await resolvePath(importName, {
      url: import.meta.url,
    })
  }
  catch { }

  if (isInstalledGlobally.value) {
    try {
      return resolveGlobal(importName)
    }
    catch { }
  }

  if (ensure)
    throw new Error(`Failed to resolve package "${importName}"`)
}

/**
 * Find the root of the package. If it is installed globally, it will also search globally.
 */
export async function findPkgRoot(dep: string, parent: string, ensure: true): Promise<string>
export async function findPkgRoot(dep: string, parent: string, ensure?: boolean): Promise<string | undefined>
export async function findPkgRoot(dep: string, parent: string, ensure = false) {
  const pkgJsonPath = await findDepPkgJsonPath(dep, parent)
  const path = pkgJsonPath ? dirname(pkgJsonPath) : isInstalledGlobally.value ? await findGlobalPkgRoot(dep, false) : undefined
  if (ensure && !path)
    throw new Error(`Failed to resolve package "${dep}"`)
  return path
}

export async function findGlobalPkgRoot(name: string, ensure: true): Promise<string>
export async function findGlobalPkgRoot(name: string, ensure?: boolean): Promise<string | undefined>
export async function findGlobalPkgRoot(name: string, ensure = false) {
  const yarnPath = join(globalDirs.yarn.packages, name)
  if (fs.existsSync(`${yarnPath}/package.json`))
    return yarnPath
  const npmPath = join(globalDirs.npm.packages, name)
  if (fs.existsSync(`${npmPath}/package.json`))
    return npmPath
  if (ensure)
    throw new Error(`Failed to resolve global package "${name}"`)
}

export async function packageExists(name: string) {
  if (await resolveImportPath(`${name}/package.json`))
    return true
  return false
}

/**
 * @TODO getRoots
 */
