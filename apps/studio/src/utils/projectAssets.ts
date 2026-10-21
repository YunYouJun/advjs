import type {
  AdvAssetEntry,
  AdvAssetLocationAdapter,
  AdvAssetResolveRequest,
} from '@advjs/types'
import type { IFileSystem } from './fs'
import {
  ADV_ASSET_MANIFEST_PATH,
  ADV_LEGACY_ASSET_INDEX_PATH,
  advAssetIncludeFilePath,
  advAssetManifestFragmentPaths,
  createAdvAssetCatalog,
  normalizeAdvAssetManifest,
  readAdvAssetIncludes,
  readAdvAssetManifestSource,
} from '@advjs/core'

const ABSOLUTE_URL_RE = /^(?:https?:|blob:|data:)/u
const ROOT_PATH = ADV_ASSET_MANIFEST_PATH
const LEGACY_INDEX_PATH = ADV_LEGACY_ASSET_INDEX_PATH

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
 * `adv/assets/index.json` path remains read-only compatibility input. The
 * reading rules are shared with native hosts through `@advjs/assets`.
 */
export async function loadStudioAssetCatalog(fs: IFileSystem) {
  const files: Record<string, string> = {}
  const hasRoot = await fs.exists(ROOT_PATH)
  const hasLegacyIndex = !hasRoot && await fs.exists(LEGACY_INDEX_PATH)
  if (!hasRoot && !hasLegacyIndex)
    return null

  const sourcePath = hasRoot ? ROOT_PATH : LEGACY_INDEX_PATH
  files[sourcePath] = await fs.readFile(sourcePath)
  for (const path of advAssetManifestFragmentPaths(files)) {
    if (await fs.exists(path))
      files[path] = await fs.readFile(path)
  }
  const manifest = readAdvAssetManifestSource(files)?.manifest
  const record = isRecord(manifest) ? manifest : {}
  const profiles = isRecord(record.profiles) ? record.profiles : undefined

  // An explicitly initialized authoring catalog can be empty. It has no media
  // resolver yet, while the rest of the project remains playable.
  if (normalizeAdvAssetManifest(manifest, { allowEmpty: true }).assets.length === 0)
    return null

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
  const includes = readAdvAssetIncludes(root, ROOT_PATH, false)
  const include = `assets/${fragmentName(asset)}`
  const includePath = advAssetIncludeFilePath(include)
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
  const legacyIncludes = readAdvAssetIncludes(parsed, LEGACY_INDEX_PATH, true)
  const root: Record<string, unknown> = {
    ...parsed,
    includes: legacyIncludes.map(include => `assets/${include}`),
  }
  delete root.assets

  if (Array.isArray(parsed.assets) && parsed.assets.length > 0) {
    const legacyInlineInclude = 'assets/legacy-inline.json'
    await fs.mkdir('adv/assets')
    await fs.writeFile(advAssetIncludeFilePath(legacyInlineInclude), json({
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
