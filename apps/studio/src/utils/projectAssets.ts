import type {
  AdvAssetEntry,
  AdvAssetLocationAdapter,
  AdvAssetResolveRequest,
} from '@advjs/types'
import type { IFileSystem } from './fs'
import { createAdvAssetCatalog } from '@advjs/core'

const ABSOLUTE_URL_RE = /^(?:https?:|blob:|data:)/u
const ROOT_PATH = 'adv/assets.json'
const LEGACY_INDEX_PATH = 'adv/assets/index.json'
const SOURCE_INCLUDE_PATH_RE = /^assets\/[a-z0-9][a-z0-9._/-]*\.json$/u
const LEGACY_INCLUDE_PATH_RE = /^[a-z0-9][a-z0-9._/-]*\.json$/u

function invalidManifest(message: string): Error {
  return new Error(`ADV_STUDIO_INVALID_ASSET_MANIFEST: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value)
  }
  catch (cause) {
    throw invalidManifest(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

function fragmentName(asset: AdvAssetEntry): string {
  if (asset.kind === 'character' || asset.kind === 'animation')
    return 'characters.json'
  if (asset.kind === 'background')
    return 'backgrounds.json'
  if (asset.kind === 'cg')
    return 'cg.json'
  if (asset.type === 'audio')
    return 'audio.json'
  return 'other.json'
}

function replaceAsset(assets: AdvAssetEntry[], next: AdvAssetEntry): AdvAssetEntry[] {
  const index = assets.findIndex(asset => asset.id === next.id)
  if (index === -1)
    return [...assets, next]
  return assets.map((asset, position) => position === index ? next : asset)
}

function assertIncludePath(include: unknown, legacy: boolean): asserts include is string {
  const pattern = legacy ? LEGACY_INCLUDE_PATH_RE : SOURCE_INCLUDE_PATH_RE
  if (typeof include !== 'string'
    || !pattern.test(include)
    || include.startsWith('/')
    || include.includes('//')
    || include.split('/').some(segment => segment === '.' || segment === '..')) {
    throw invalidManifest(`include path is invalid: ${String(include)}`)
  }
}

function sourceIncludePath(include: string): string {
  return `adv/${include}`
}

function legacyIncludePath(include: string): string {
  return `adv/assets/${include}`
}

function assertSplitRoot(record: Record<string, unknown>, label: string, legacy: boolean): string[] {
  if (record.schemaVersion !== 2 || !Array.isArray(record.includes))
    throw invalidManifest(`${label} must declare schemaVersion 2 and includes`)
  const includes = record.includes.map((include) => {
    assertIncludePath(include, legacy)
    return include
  })
  if (new Set(includes).size !== includes.length)
    throw invalidManifest(`${label} must not contain duplicate includes`)
  return includes
}

async function readFragment(fs: IFileSystem, include: string, legacy: boolean): Promise<AdvAssetEntry[]> {
  const path = legacy ? legacyIncludePath(include) : sourceIncludePath(include)
  if (!await fs.exists(path))
    throw invalidManifest(`included fragment does not exist: ${include}`)
  const fragment = parseJson(await fs.readFile(path), include)
  if (!isRecord(fragment) || fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
    throw invalidManifest(`${include} must declare schemaVersion 2 and assets`)
  return fragment.assets as AdvAssetEntry[]
}

async function flattenSplitRoot(
  fs: IFileSystem,
  root: Record<string, unknown>,
  label: string,
  legacy: boolean,
): Promise<Record<string, unknown>> {
  const includes = assertSplitRoot(root, label, legacy)
  const assets = legacy && Array.isArray(root.assets)
    ? [...root.assets as AdvAssetEntry[]]
    : []
  for (const include of includes)
    assets.push(...await readFragment(fs, include, legacy))
  const normalized: Record<string, unknown> = { ...root, assets }
  delete normalized.includes
  return normalized
}

function createProjectAssetAdapter(fs: IFileSystem): AdvAssetLocationAdapter {
  const blobUrls = new Set<string>()
  return {
    async resolve(request: AdvAssetResolveRequest) {
      if (request.provider === 'project') {
        const url = await fs.readBlobUrl(request.location)
        blobUrls.add(url)
        return url
      }
      if (ABSOLUTE_URL_RE.test(request.location))
        return request.location
      if (!request.baseUrl)
        throw invalidManifest(`HTTP profile "${request.profile}" has no baseUrl`)
      return new URL(request.location, request.baseUrl).href
    },
    dispose() {
      for (const url of blobUrls) {
        if (url.startsWith('blob:'))
          URL.revokeObjectURL(url)
      }
      blobUrls.clear()
    },
  }
}

/**
 * Load the project resource catalog used by Studio preview.
 *
 * `adv/assets.json` is the only writable root. It contains either inline
 * `assets` or `includes` pointing below `adv/assets/`, never both. The former
 * `adv/assets/index.json` path remains read-only compatibility input.
 */
export async function loadStudioAssetCatalog(fs: IFileSystem) {
  const hasRoot = await fs.exists(ROOT_PATH)
  const hasLegacyIndex = !hasRoot && await fs.exists(LEGACY_INDEX_PATH)
  if (!hasRoot && !hasLegacyIndex)
    return null

  const sourcePath = hasRoot ? ROOT_PATH : LEGACY_INDEX_PATH
  const parsed = parseJson(await fs.readFile(sourcePath), sourcePath)
  let manifest: unknown = parsed

  if (hasRoot && isRecord(parsed) && parsed.schemaVersion === 2) {
    const hasAssets = Object.hasOwn(parsed, 'assets')
    const hasIncludes = Object.hasOwn(parsed, 'includes')
    if (hasAssets === hasIncludes)
      throw invalidManifest('adv/assets.json must declare exactly one of assets or includes')
    if (hasAssets && !Array.isArray(parsed.assets))
      throw invalidManifest('adv/assets.json assets must be an array')
    if (hasIncludes)
      manifest = await flattenSplitRoot(fs, parsed, ROOT_PATH, false)
  }
  else if (!hasRoot) {
    if (!isRecord(parsed))
      throw invalidManifest('adv/assets/index.json must be an object')
    manifest = await flattenSplitRoot(fs, parsed, LEGACY_INDEX_PATH, true)
  }

  const record = isRecord(manifest) ? manifest : {}
  const profiles = isRecord(record.profiles) ? record.profiles : undefined

  return createAdvAssetCatalog(manifest, {
    adapter: createProjectAssetAdapter(fs),
    profile: profiles?.local ? 'local' : undefined,
  })
}

function ensureLocalProfile(manifest: Record<string, unknown>): void {
  const previousDefault = typeof manifest.defaultProfile === 'string' ? manifest.defaultProfile : undefined
  const profiles = isRecord(manifest.profiles) ? manifest.profiles : {}
  profiles.local = {
    provider: 'project',
    root: 'adv/assets',
    ...(previousDefault && previousDefault !== 'local' ? { fallback: previousDefault } : {}),
  }
  manifest.profiles = profiles
}

async function upsertSplitAsset(
  fs: IFileSystem,
  root: Record<string, unknown>,
  asset: AdvAssetEntry,
): Promise<void> {
  const includes = assertSplitRoot(root, ROOT_PATH, false)
  const include = `assets/${fragmentName(asset)}`
  const includePath = sourceIncludePath(include)
  let fragment: Record<string, unknown> = { schemaVersion: 2, assets: [] }
  if (await fs.exists(includePath)) {
    const parsed = parseJson(await fs.readFile(includePath), include)
    if (!isRecord(parsed) || parsed.schemaVersion !== 2 || !Array.isArray(parsed.assets))
      throw invalidManifest(`${include} must declare schemaVersion 2 and assets`)
    fragment = parsed
  }
  fragment.assets = replaceAsset(fragment.assets as AdvAssetEntry[], asset)
  if (!includes.includes(include))
    includes.push(include)
  root.includes = includes

  await fs.mkdir('adv/assets')
  await fs.writeFile(includePath, json(fragment))
  // Write the canonical root last so readers never observe a missing fragment.
  await fs.writeFile(ROOT_PATH, json(root))
}

async function migrateLegacyIndex(fs: IFileSystem): Promise<Record<string, unknown>> {
  const parsed = parseJson(await fs.readFile(LEGACY_INDEX_PATH), LEGACY_INDEX_PATH)
  if (!isRecord(parsed))
    throw invalidManifest('adv/assets/index.json must be an object')
  const legacyIncludes = assertSplitRoot(parsed, LEGACY_INDEX_PATH, true)
  const root: Record<string, unknown> = {
    ...parsed,
    includes: legacyIncludes.map(include => `assets/${include}`),
  }
  delete root.assets

  if (Array.isArray(parsed.assets) && parsed.assets.length > 0) {
    const legacyInlineInclude = 'assets/legacy-inline.json'
    await fs.mkdir('adv/assets')
    await fs.writeFile(sourceIncludePath(legacyInlineInclude), json({
      schemaVersion: 2,
      assets: parsed.assets,
    }))
    const rootIncludes = root.includes as string[]
    rootIncludes.push(legacyInlineInclude)
  }
  return root
}

/**
 * Register a local authoring file without coupling content references to paths.
 * New and migrated projects keep one writable root at `adv/assets.json`.
 */
export async function upsertStudioProjectAsset(
  fs: IFileSystem,
  asset: AdvAssetEntry,
  options: { catalogId: string },
): Promise<void> {
  if (!asset.id || !asset.path)
    throw invalidManifest('a local asset requires id and path')

  if (await fs.exists(ROOT_PATH)) {
    const parsed = parseJson(await fs.readFile(ROOT_PATH), ROOT_PATH)
    if (!isRecord(parsed) || parsed.schemaVersion !== 2)
      throw invalidManifest('Studio can only update schema v2 asset catalogs')
    const hasAssets = Object.hasOwn(parsed, 'assets')
    const hasIncludes = Object.hasOwn(parsed, 'includes')
    if (hasAssets === hasIncludes)
      throw invalidManifest('adv/assets.json must declare exactly one of assets or includes')
    ensureLocalProfile(parsed)
    if (hasAssets) {
      if (!Array.isArray(parsed.assets))
        throw invalidManifest('adv/assets.json assets must be an array')
      parsed.assets = replaceAsset(parsed.assets as AdvAssetEntry[], asset)
      await fs.writeFile(ROOT_PATH, json(parsed))
      return
    }
    await upsertSplitAsset(fs, parsed, asset)
    return
  }

  const migratingLegacy = await fs.exists(LEGACY_INDEX_PATH)
  const root: Record<string, unknown> = migratingLegacy
    ? await migrateLegacyIndex(fs)
    : {
        schemaVersion: 2,
        id: options.catalogId,
        defaultProfile: 'local',
        profiles: { local: { provider: 'project', root: 'adv/assets' } },
        includes: [],
      }
  ensureLocalProfile(root)
  await upsertSplitAsset(fs, root, asset)
  if (migratingLegacy)
    await fs.deleteFile(LEGACY_INDEX_PATH)
}
