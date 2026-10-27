/**
 * Read a project's asset manifest from its source files.
 *
 * `adv/assets.json` is the canonical root. It declares either inline `assets`
 * or `includes` of fragments below `adv/assets/`, never both. The earlier
 * `adv/assets/index.json` root stays readable for compatibility.
 */

/** Canonical, writable manifest root. */
export const ADV_ASSET_MANIFEST_PATH = 'adv/assets.json'
/** Read-only compatibility root. */
export const ADV_LEGACY_ASSET_INDEX_PATH = 'adv/assets/index.json'

const SOURCE_INCLUDE_PATH_RE = /^assets\/[a-z0-9][a-z0-9._/-]*\.json$/u
const LEGACY_INCLUDE_PATH_RE = /^[a-z0-9][a-z0-9._/-]*\.json$/u

export interface AdvAssetManifestSource {
  /** The root the manifest was read from. */
  path: typeof ADV_ASSET_MANIFEST_PATH | typeof ADV_LEGACY_ASSET_INDEX_PATH
  /** Flattened manifest input for `normalizeAdvAssetManifest`. */
  manifest: unknown
}

function invalid(message: string): Error {
  return new Error(`ADV_ASSET_MANIFEST_INVALID: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value)
  }
  catch (cause) {
    throw invalid(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

/** Validate one `includes` entry of a split root. */
export function assertAdvAssetIncludePath(include: unknown, legacy = false): asserts include is string {
  const pattern = legacy ? LEGACY_INCLUDE_PATH_RE : SOURCE_INCLUDE_PATH_RE
  if (typeof include !== 'string'
    || !pattern.test(include)
    || include.startsWith('/')
    || include.includes('//')
    || include.split('/').some(segment => segment === '.' || segment === '..')) {
    throw invalid(`include path is invalid: ${String(include)}`)
  }
}

/** Project path of an include, relative to the canonical or the legacy root. */
export function advAssetIncludeFilePath(include: string, legacy = false): string {
  return legacy ? `adv/assets/${include}` : `adv/${include}`
}

/** Validated includes of a split root (`schemaVersion: 2` with `includes`). */
export function readAdvAssetIncludes(root: Record<string, unknown>, label: string, legacy: boolean): string[] {
  if (root.schemaVersion !== 2 || !Array.isArray(root.includes))
    throw invalid(`${label} must declare schemaVersion 2 and includes`)
  const includes = root.includes.map((include) => {
    assertAdvAssetIncludePath(include, legacy)
    return include
  })
  if (new Set(includes).size !== includes.length)
    throw invalid(`${label} must not contain duplicate includes`)
  return includes
}

function rootOf(files: Readonly<Record<string, string | undefined>>): { path: AdvAssetManifestSource['path'], legacy: boolean } | undefined {
  if (files[ADV_ASSET_MANIFEST_PATH] !== undefined)
    return { path: ADV_ASSET_MANIFEST_PATH, legacy: false }
  if (files[ADV_LEGACY_ASSET_INDEX_PATH] !== undefined)
    return { path: ADV_LEGACY_ASSET_INDEX_PATH, legacy: true }
  return undefined
}

function isSplitRoot(root: unknown, legacy: boolean): root is Record<string, unknown> {
  if (legacy)
    return true
  return isRecord(root) && root.schemaVersion === 2 && Object.hasOwn(root, 'includes') && !Object.hasOwn(root, 'assets')
}

/**
 * Fragment files a manifest root refers to, so hosts with asynchronous file
 * access can read exactly those before calling {@link readAdvAssetManifestSource}.
 */
export function advAssetManifestFragmentPaths(files: Readonly<Record<string, string | undefined>>): string[] {
  const root = rootOf(files)
  if (!root)
    return []
  const parsed = parseJson(files[root.path]!, root.path)
  if (!isSplitRoot(parsed, root.legacy))
    return []
  if (!isRecord(parsed))
    throw invalid(`${root.path} must be an object`)
  return readAdvAssetIncludes(parsed, root.path, root.legacy)
    .map(include => advAssetIncludeFilePath(include, root.legacy))
}

function readFragment(
  files: Readonly<Record<string, string | undefined>>,
  include: string,
  legacy: boolean,
): unknown[] {
  const content = files[advAssetIncludeFilePath(include, legacy)]
  if (content === undefined)
    throw invalid(`included fragment does not exist: ${include}`)
  const fragment = parseJson(content, include)
  if (!isRecord(fragment) || fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
    throw invalid(`${include} must declare schemaVersion 2 and assets`)
  return fragment.assets
}

function flattenSplitRoot(
  files: Readonly<Record<string, string | undefined>>,
  root: Record<string, unknown>,
  label: string,
  legacy: boolean,
): Record<string, unknown> {
  const includes = readAdvAssetIncludes(root, label, legacy)
  const assets = legacy && Array.isArray(root.assets)
    ? [...root.assets]
    : []
  for (const include of includes)
    assets.push(...readFragment(files, include, legacy))
  const normalized: Record<string, unknown> = { ...root, assets }
  delete normalized.includes
  return normalized
}

/**
 * Flatten the project's asset manifest from `files` (project-relative path →
 * text). Returns `null` when the project has no manifest root; throws
 * `ADV_ASSET_MANIFEST_INVALID` for malformed roots, includes or fragments.
 */
export function readAdvAssetManifestSource(
  files: Readonly<Record<string, string | undefined>>,
): AdvAssetManifestSource | null {
  const root = rootOf(files)
  if (!root)
    return null

  const parsed = parseJson(files[root.path]!, root.path)
  let manifest: unknown = parsed

  if (!root.legacy && isRecord(parsed) && parsed.schemaVersion === 2) {
    const hasAssets = Object.hasOwn(parsed, 'assets')
    const hasIncludes = Object.hasOwn(parsed, 'includes')
    if (hasAssets === hasIncludes)
      throw invalid('adv/assets.json must declare exactly one of assets or includes')
    if (hasAssets && !Array.isArray(parsed.assets))
      throw invalid('adv/assets.json assets must be an array')
    if (hasIncludes)
      manifest = flattenSplitRoot(files, parsed, root.path, false)
  }
  else if (root.legacy) {
    if (!isRecord(parsed))
      throw invalid('adv/assets/index.json must be an object')
    manifest = flattenSplitRoot(files, parsed, root.path, true)
  }

  return { path: root.path, manifest }
}
