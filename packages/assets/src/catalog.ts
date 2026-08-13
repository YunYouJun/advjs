import type {
  AdvAssetEntry,
  AdvAssetLocationAdapter,
  AdvAssetManifest,
  AdvAssetProfile,
  AdvAssetResolveRequest,
  AdvAssetType,
  AdvAssetVariant,
  AdvResolvedAsset,
} from '@advjs/types'

export interface AdvAssetCatalogQuery {
  kind?: string
  type?: AdvAssetType
  bundle?: string
  label?: string
}

export interface AdvAssetResolveOptions {
  profile?: string
  variant?: string
}

export interface AdvAssetCatalog {
  get: (id: string) => AdvAssetEntry | undefined
  list: (query?: AdvAssetCatalogQuery) => AdvAssetEntry[]
  resolve: (id: string, options?: AdvAssetResolveOptions) => Promise<AdvResolvedAsset>
  dispose: () => void
}

export interface CreateAdvAssetCatalogOptions {
  adapter?: AdvAssetLocationAdapter
  profile?: string
}

interface LegacyAssetManifest {
  schemaVersion?: number
  id?: string
  publicBaseUrl?: string
  objectPrefix?: string
  manifestObjectKey?: string
  assets?: unknown[]
}

const ABSOLUTE_URL_RE = /^(?:https?:|blob:|data:)/u

function fail(message: string): Error {
  return new Error(`ADV_ASSET_CATALOG_INVALID: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function inferAssetType(kind: string, mimeType?: string): AdvAssetType {
  if (mimeType?.startsWith('audio/') || ['bgm', 'sfx', 'voice'].includes(kind))
    return 'audio'
  if (mimeType?.startsWith('video/') || kind === 'video')
    return 'video'
  if (kind === 'font')
    return 'font'
  if (kind === 'model')
    return 'model'
  if (kind === 'data')
    return 'data'
  return 'image'
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === 'string' ? record[key] : undefined
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  return typeof record[key] === 'number' ? record[key] : undefined
}

function normalizeVariant(value: unknown): AdvAssetVariant {
  if (!isRecord(value))
    return {}
  return {
    path: optionalString(value, 'path'),
    objectKey: optionalString(value, 'objectKey'),
    url: optionalString(value, 'url'),
    sha256: optionalString(value, 'sha256'),
    bytes: optionalNumber(value, 'bytes'),
    mimeType: optionalString(value, 'mimeType'),
    width: optionalNumber(value, 'width'),
    height: optionalNumber(value, 'height'),
  }
}

function normalizeEntry(value: unknown): AdvAssetEntry {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id)
    throw fail('every asset must have a non-empty id')
  const kind = typeof value.kind === 'string' && value.kind ? value.kind : 'data'
  const base = normalizeVariant(value)
  const variants: Record<string, AdvAssetVariant> = {}
  const source = isRecord(value.source) && typeof value.source.type === 'string'
    ? {
        type: value.source.type,
        model: optionalString(value.source, 'model'),
        promptVersion: optionalString(value.source, 'promptVersion'),
        createdAt: optionalString(value.source, 'createdAt'),
        sourceUrl: optionalString(value.source, 'sourceUrl'),
        derivedFrom: optionalString(value.source, 'derivedFrom'),
      }
    : undefined
  if (isRecord(value.variants)) {
    for (const [name, variant] of Object.entries(value.variants))
      variants[name] = normalizeVariant(variant)
  }

  // v1 CG manifests represented the thumbnail as flattened fields.
  if (!variants.thumbnail && (value.thumbnailObjectKey || value.thumbnailUrl)) {
    variants.thumbnail = {
      objectKey: optionalString(value, 'thumbnailObjectKey'),
      url: optionalString(value, 'thumbnailUrl'),
      sha256: optionalString(value, 'thumbnailSha256'),
      bytes: optionalNumber(value, 'thumbnailBytes'),
      width: optionalNumber(value, 'thumbnailWidth'),
      height: optionalNumber(value, 'thumbnailHeight'),
    }
  }

  return {
    id: value.id,
    kind,
    type: typeof value.type === 'string'
      ? value.type as AdvAssetType
      : inferAssetType(kind, base.mimeType),
    bundle: optionalString(value, 'bundle'),
    labels: Array.isArray(value.labels) && value.labels.every(label => typeof label === 'string')
      ? value.labels
      : undefined,
    ...base,
    variants: Object.keys(variants).length > 0 ? variants : undefined,
    title: optionalString(value, 'title'),
    alt: optionalString(value, 'alt'),
    chapterId: optionalString(value, 'chapterId'),
    characterId: optionalString(value, 'characterId'),
    expression: optionalString(value, 'expression'),
    sceneId: optionalString(value, 'sceneId'),
    state: optionalString(value, 'state'),
    duration: optionalNumber(value, 'duration'),
    loop: typeof value.loop === 'boolean' ? value.loop : undefined,
    frameWidth: optionalNumber(value, 'frameWidth'),
    frameHeight: optionalNumber(value, 'frameHeight'),
    frames: optionalNumber(value, 'frames'),
    fps: optionalNumber(value, 'fps'),
    license: optionalString(value, 'license'),
    source,
  }
}

function normalizeProfile(value: unknown, name: string): AdvAssetProfile {
  if (!isRecord(value) || (value.provider !== 'project' && value.provider !== 'http'))
    throw fail(`profile "${name}" must declare provider project or http`)
  const profile: AdvAssetProfile = {
    provider: value.provider,
    root: optionalString(value, 'root'),
    baseUrl: optionalString(value, 'baseUrl'),
    fallback: optionalString(value, 'fallback'),
  }
  if (profile.provider === 'http' && !profile.baseUrl)
    throw fail(`HTTP profile "${name}" must declare baseUrl`)
  return profile
}

export function normalizeAdvAssetManifest(input: unknown): AdvAssetManifest {
  if (!isRecord(input))
    throw fail('manifest root must be an object')
  const rawAssets = Array.isArray(input.assets) ? input.assets : []
  const assets = rawAssets.map(normalizeEntry)
  if (assets.length === 0)
    throw fail('manifest must contain at least one asset')

  if (input.schemaVersion === 2) {
    if (typeof input.id !== 'string' || !input.id)
      throw fail('schema v2 manifest must declare id')
    if (typeof input.defaultProfile !== 'string' || !input.defaultProfile)
      throw fail('schema v2 manifest must declare defaultProfile')
    if (!isRecord(input.profiles))
      throw fail('schema v2 manifest must declare profiles')
    const profiles = Object.fromEntries(
      Object.entries(input.profiles).map(([name, value]) => [name, normalizeProfile(value, name)]),
    )
    if (!profiles[input.defaultProfile])
      throw fail(`default profile "${input.defaultProfile}" does not exist`)

    const bundles = Array.isArray(input.bundles)
      ? input.bundles.map((bundle) => {
          if (!isRecord(bundle) || typeof bundle.id !== 'string' || !bundle.id)
            throw fail('every bundle must have a non-empty id')
          return {
            id: bundle.id,
            preload: typeof bundle.preload === 'boolean' ? bundle.preload : undefined,
            labels: Array.isArray(bundle.labels) && bundle.labels.every(label => typeof label === 'string')
              ? bundle.labels
              : undefined,
          }
        })
      : undefined

    return {
      schemaVersion: 2,
      id: input.id,
      defaultProfile: input.defaultProfile,
      profiles,
      bundles,
      assets,
      release: isRecord(input.release) && typeof input.release.provider === 'string' && typeof input.release.objectPrefix === 'string'
        ? { provider: input.release.provider, objectPrefix: input.release.objectPrefix }
        : undefined,
      manifestObjectKey: optionalString(input, 'manifestObjectKey'),
    }
  }

  const publicBaseUrl = optionalString(input, 'publicBaseUrl')
  if (!publicBaseUrl)
    throw fail('legacy manifest must declare publicBaseUrl')
  return {
    schemaVersion: 2,
    id: optionalString(input, 'id') ?? 'legacy',
    defaultProfile: 'production',
    profiles: {
      production: { provider: 'http', baseUrl: publicBaseUrl },
    },
    assets,
    manifestObjectKey: optionalString(input, 'manifestObjectKey'),
  }
}

function joinProjectPath(root: string | undefined, path: string): string {
  const normalizedRoot = root?.replace(/^\.\/?|\/$/gu, '') ?? ''
  const normalizedPath = path.replace(/^\.\/?|^\//gu, '')
  return normalizedRoot ? `${normalizedRoot}/${normalizedPath}` : normalizedPath
}

export function createHttpAssetAdapter(): AdvAssetLocationAdapter {
  return {
    resolve(request) {
      if (request.provider === 'project')
        return request.location
      if (ABSOLUTE_URL_RE.test(request.location))
        return request.location
      if (!request.baseUrl)
        throw fail(`HTTP profile "${request.profile}" has no baseUrl`)
      return new URL(request.location, request.baseUrl).href
    },
  }
}

export function createAdvAssetCatalog(
  input: AdvAssetManifest | LegacyAssetManifest | unknown,
  options: CreateAdvAssetCatalogOptions = {},
): AdvAssetCatalog {
  const manifest = normalizeAdvAssetManifest(input)
  const adapter = options.adapter ?? createHttpAssetAdapter()
  const byId = new Map<string, AdvAssetEntry>()
  for (const asset of manifest.assets) {
    if (byId.has(asset.id))
      throw fail(`duplicate asset id: ${asset.id}`)
    byId.set(asset.id, asset)
  }

  const bundleIds = new Set(manifest.bundles?.map(bundle => bundle.id) ?? [])
  for (const asset of manifest.assets) {
    if (asset.bundle && bundleIds.size > 0 && !bundleIds.has(asset.bundle))
      throw fail(`asset "${asset.id}" references unknown bundle "${asset.bundle}"`)
  }

  function getLocation(asset: AdvAssetEntry, variant: string | undefined, profile: AdvAssetProfile): string | undefined {
    const location = variant ? asset.variants?.[variant] : asset
    if (!location)
      throw fail(`asset "${asset.id}" has no variant "${variant}"`)
    if (profile.provider === 'project')
      return location.path ? joinProjectPath(profile.root, location.path) : undefined
    return location.url ?? location.objectKey
  }

  async function resolveWithProfile(
    asset: AdvAssetEntry,
    variant: string | undefined,
    profileName: string,
    visited = new Set<string>(),
  ): Promise<{ src: string, location: AdvAssetVariant }> {
    if (visited.has(profileName))
      throw fail(`profile fallback cycle at "${profileName}"`)
    visited.add(profileName)
    const profile = manifest.profiles[profileName]
    if (!profile)
      throw fail(`unknown profile "${profileName}"`)
    const variantLocation = variant ? asset.variants?.[variant] : asset
    if (!variantLocation)
      throw fail(`asset "${asset.id}" has no variant "${variant}"`)
    const location = getLocation(asset, variant, profile)
    if (location) {
      const request: AdvAssetResolveRequest = {
        provider: profile.provider,
        profile: profileName,
        location,
        baseUrl: profile.baseUrl,
        asset,
        variant,
      }
      try {
        return { src: await adapter.resolve(request), location: variantLocation }
      }
      catch (error) {
        if (!profile.fallback)
          throw error
      }
    }
    if (profile.fallback)
      return resolveWithProfile(asset, variant, profile.fallback, visited)
    throw fail(`asset "${asset.id}" has no location for profile "${profileName}"`)
  }

  return {
    get(id) {
      return byId.get(id)
    },
    list(query = {}) {
      return manifest.assets.filter(asset => (
        (!query.kind || asset.kind === query.kind)
        && (!query.type || asset.type === query.type)
        && (!query.bundle || asset.bundle === query.bundle)
        && (!query.label || asset.labels?.includes(query.label))
      ))
    },
    async resolve(id, resolveOptions = {}) {
      const asset = byId.get(id)
      if (!asset)
        throw new Error(`ADV_ASSET_NOT_FOUND: ${id}`)
      const variant = resolveOptions.variant
      const { src, location } = await resolveWithProfile(
        asset,
        variant,
        resolveOptions.profile ?? options.profile ?? manifest.defaultProfile,
      )
      return {
        id: asset.id,
        kind: asset.kind,
        type: asset.type,
        bundle: asset.bundle,
        variant,
        src,
        sha256: location.sha256,
        bytes: location.bytes,
        mimeType: location.mimeType,
        width: location.width,
        height: location.height,
      }
    },
    dispose() {
      adapter.dispose?.()
    },
  }
}
