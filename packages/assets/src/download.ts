import type { AdvAssetDownloadSource, AdvAssetManifest, AdvAssetVariant } from '@advjs/types'

export interface AdvAssetDownloadItem {
  id: string
  variant: string
  /** Validated, project-relative destination. */
  path: string
  objectKey?: string
  sha256: string
  bytes: number
}

export interface AdvAssetDownloadPlan {
  source?: AdvAssetDownloadSource
  items: AdvAssetDownloadItem[]
}

export interface AdvAssetDownloadSelection {
  /** Defaults to the base entry (named default); named variants do not inherit base metadata. */
  variants?: string[]
  allVariants?: boolean
}

/** Reject ambiguous or escaping coordinates before a storage adapter sees them. */
export function assertAdvAssetDownloadPath(path: string): void {
  if (!path || /[\\:?#%]/u.test(path) || [...path].some(character => character.charCodeAt(0) < 32)
    || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid asset download path')
  }
}

/** Pure planning only: filesystem, authorization and downloading belong to Node adapters. */
export function planAdvAssetDownloads(manifest: AdvAssetManifest, selection: AdvAssetDownloadSelection = {}): AdvAssetDownloadPlan {
  const profile = manifest.profiles[manifest.download?.profile ?? manifest.defaultProfile]
  if (!profile || profile.provider !== 'project')
    throw new Error('Asset downloads require a project profile')
  const root = profile.root?.replace(/^\.\//u, '').replace(/\/$/u, '')
  if (root)
    assertAdvAssetDownloadPath(root)
  const source = manifest.download?.source
  if (source?.provider === 'tencent-cos') {
    if (!/^[a-z0-9-]+-\d+$/u.test(source.bucket) || !/^[a-z]+-[a-z0-9-]+$/u.test(source.region))
      throw new Error('Invalid COS bucket or region')
  }
  if (source?.provider === 'http') {
    const url = new URL(source.baseUrl)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/'))
      throw new Error('Download HTTP baseUrl must be an unsigned HTTP(S) directory URL')
  }
  const requested = new Set(selection.variants?.length ? selection.variants : ['default'])
  const available = new Set(['default'])
  const paths = new Set<string>()
  const ids = new Set<string>()
  const items: AdvAssetDownloadItem[] = []
  for (const asset of manifest.assets) {
    if (ids.has(asset.id))
      throw new Error('Duplicate asset download ID')
    ids.add(asset.id)
    if (asset.variants?.default)
      throw new Error('The variant name default is reserved for the base asset')
    const locations: Array<[string, AdvAssetVariant]> = [['default', asset], ...Object.entries(asset.variants ?? {})]
    for (const [variant, file] of locations) {
      available.add(variant)
      // Validate all declared cache coordinates, including variants not selected this time.
      if (file.path)
        assertAdvAssetDownloadPath(file.path)
      if (file.cachePath)
        assertAdvAssetDownloadPath(file.cachePath)
      if (file.objectKey)
        assertAdvAssetDownloadPath(file.objectKey)
      const path = file.cachePath ?? (file.path ? [root, file.path].filter(Boolean).join('/') : undefined)
      if (path) {
        if (paths.has(path))
          throw new Error('Duplicate asset download destination')
        paths.add(path)
      }
      if (!selection.allVariants && !requested.has(variant))
        continue
      if (!path || !/^[a-f0-9]{64}$/u.test(file.sha256 ?? '') || !Number.isSafeInteger(file.bytes) || file.bytes! <= 0)
        throw new Error(`Asset ${asset.id} (${variant}) requires a cache path, SHA-256 and positive byte count`)
      items.push({ id: asset.id, variant, path, objectKey: file.objectKey, sha256: file.sha256!, bytes: file.bytes! })
    }
  }
  if (!selection.allVariants && [...requested].some(variant => !available.has(variant)))
    throw new Error('Unknown asset download variant')
  return { source, items }
}
