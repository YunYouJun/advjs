import type { AdvAssetEntry, AdvAssetManifest } from '@advjs/types'
import { normalizeAdvAssetManifest } from './catalog'

export interface PlanAdvAssetManifestUpsertInput {
  files: Readonly<Record<string, string>>
  rootPath: string
  catalogId: string
  asset: AdvAssetEntry
  replaceExisting?: boolean
}

export interface AdvAssetManifestUpsertPlan {
  manifest: AdvAssetManifest
  writes: Record<string, string>
}

const INCLUDE_RE = /^assets\/[a-z0-9][a-z0-9._/-]*\.json$/u

function fail(message: string): never {
  throw new Error(`ADV_ASSET_AUTHORING_INVALID: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function parseJson(content: string, path: string): Record<string, unknown> {
  try {
    const value = JSON.parse(content)
    if (!isRecord(value))
      fail(`${path} must contain an object`)
    return value
  }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('ADV_ASSET_AUTHORING_INVALID:'))
      throw error
    fail(`${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function dirname(path: string) {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function join(...parts: string[]) {
  return parts.filter(Boolean).join('/')
}

function assertInclude(include: unknown): asserts include is string {
  if (typeof include !== 'string'
    || !INCLUDE_RE.test(include)
    || include.includes('//')
    || include.split('/').some(segment => segment === '.' || segment === '..')) {
    fail(`invalid asset include: ${String(include)}`)
  }
}

function ensureLocalProfile(root: Record<string, unknown>) {
  const defaultProfile = typeof root.defaultProfile === 'string' ? root.defaultProfile : undefined
  const profiles = isRecord(root.profiles) ? { ...root.profiles } : {}
  profiles.local = {
    provider: 'project',
    root: 'adv/assets',
    ...(defaultProfile && defaultProfile !== 'local' ? { fallback: defaultProfile } : {}),
  }
  root.profiles = profiles
}

function canReplace(current: AdvAssetEntry, next: AdvAssetEntry, replaceExisting: boolean) {
  if (current.sha256 === next.sha256 && current.path === next.path)
    return
  if (!replaceExisting)
    fail(`asset id already exists: ${next.id}; pass replaceExisting only after explicit review`)
}

function upsert(
  assets: AdvAssetEntry[],
  next: AdvAssetEntry,
  replaceExisting: boolean,
): AdvAssetEntry[] {
  const index = assets.findIndex(asset => asset.id === next.id)
  if (index === -1)
    return [...assets, next]
  canReplace(assets[index], next, replaceExisting)
  return assets.map((asset, position) => position === index ? next : asset)
}

function defaultFragment(asset: AdvAssetEntry) {
  if (asset.kind === 'background')
    return 'assets/backgrounds.json'
  if (asset.kind === 'cg')
    return 'assets/cg.json'
  if (asset.type === 'audio')
    return 'assets/audio.json'
  return 'assets/other.json'
}

export function planAdvAssetManifestUpsert(input: PlanAdvAssetManifestUpsertInput): AdvAssetManifestUpsertPlan {
  if (!input.asset.id || !input.asset.path)
    fail('local assets require a stable id and project-relative path')
  const writes: Record<string, string> = {}
  const replaceExisting = input.replaceExisting ?? false
  const rootDirectory = dirname(input.rootPath)
  let root: Record<string, unknown>

  if (!input.files[input.rootPath]) {
    const include = defaultFragment(input.asset)
    root = {
      schemaVersion: 2,
      id: input.catalogId,
      defaultProfile: 'local',
      profiles: { local: { provider: 'project', root: 'adv/assets' } },
      includes: [include],
    }
    writes[join(rootDirectory, include)] = json({ schemaVersion: 2, assets: [input.asset] })
  }
  else {
    root = { ...parseJson(input.files[input.rootPath], input.rootPath) }
    if (root.schemaVersion !== 2)
      fail('only schema v2 asset manifests are writable')
    const hasAssets = Object.hasOwn(root, 'assets')
    const hasIncludes = Object.hasOwn(root, 'includes')
    if (hasAssets === hasIncludes)
      fail(`${input.rootPath} must declare exactly one of assets or includes`)

    if (hasAssets) {
      if (!Array.isArray(root.assets))
        fail(`${input.rootPath} assets must be an array`)
      root.assets = upsert(root.assets as AdvAssetEntry[], input.asset, replaceExisting)
    }
    else {
      if (!Array.isArray(root.includes))
        fail(`${input.rootPath} includes must be an array`)
      const includes = root.includes.map((include) => {
        assertInclude(include)
        return include
      })
      if (new Set(includes).size !== includes.length)
        fail(`${input.rootPath} must not contain duplicate includes`)

      let targetInclude: string | undefined
      for (const include of includes) {
        const path = join(rootDirectory, include)
        const content = input.files[path]
        if (!content)
          fail(`asset manifest fragment not found: ${path}`)
        const fragment = parseJson(content, path)
        if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
          fail(`${path} must declare schemaVersion 2 and assets`)
        if ((fragment.assets as AdvAssetEntry[]).some(asset => asset.id === input.asset.id))
          targetInclude = include
      }
      targetInclude ??= defaultFragment(input.asset)
      const targetPath = join(rootDirectory, targetInclude)
      const targetFragment = input.files[targetPath]
        ? parseJson(input.files[targetPath], targetPath)
        : { schemaVersion: 2, assets: [] }
      if (!Array.isArray(targetFragment.assets))
        fail(`${targetPath} assets must be an array`)
      targetFragment.assets = upsert(targetFragment.assets as AdvAssetEntry[], input.asset, replaceExisting)
      writes[targetPath] = json(targetFragment)
      if (!includes.includes(targetInclude))
        includes.push(targetInclude)
      root.includes = includes
    }
  }

  ensureLocalProfile(root)
  writes[input.rootPath] = json(root)

  const allFiles = { ...input.files, ...writes }
  const assets: AdvAssetEntry[] = []
  if (Array.isArray(root.assets)) {
    assets.push(...root.assets as AdvAssetEntry[])
  }
  else {
    for (const include of root.includes as string[]) {
      const fragment = parseJson(allFiles[join(rootDirectory, include)], include)
      assets.push(...fragment.assets as AdvAssetEntry[])
    }
  }
  const { includes: _includes, ...manifestBase } = root
  const manifest = normalizeAdvAssetManifest({ ...manifestBase, assets })
  return { manifest, writes }
}
