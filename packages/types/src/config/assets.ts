export type AdvAssetProvider = 'project' | 'http'

export type AdvAssetType = 'image' | 'audio' | 'video' | 'font' | 'model' | 'data'

export interface AdvAssetProfile {
  /** Adapter used to turn a logical location into a loadable URL. */
  provider: AdvAssetProvider
  /** Project-relative root for local authoring assets. */
  root?: string
  /** Absolute base URL for published artifacts. */
  baseUrl?: string
  /** Profile tried when this profile has no location or cannot resolve it. */
  fallback?: string
}

export interface AdvAssetBundle {
  id: string
  /** Load this bundle before entering the first chapter. */
  preload?: boolean
  labels?: string[]
}

export interface AdvAssetVariant {
  /** Project-relative authoring file. */
  path?: string
  /** Published object key, resolved against the HTTP profile base URL. */
  objectKey?: string
  /** Compatibility escape hatch for an already absolute published URL. */
  url?: string
  sha256?: string
  bytes?: number
  mimeType?: string
  width?: number
  height?: number
}

export interface AdvAssetProvenance {
  type: 'generated' | 'licensed' | 'original' | 'derived' | string
  model?: string
  promptVersion?: string
  createdAt?: string
  sourceUrl?: string
  derivedFrom?: string
}

export interface AdvAssetEntry extends AdvAssetVariant {
  /** Stable address used by scripts, settings and Studio. */
  id: string
  /** Domain-specific kind such as background, character, cg, bgm or sfx. */
  kind: string
  /** Transport-level media type used by loaders. */
  type: AdvAssetType
  bundle?: string
  labels?: string[]
  variants?: Record<string, AdvAssetVariant>
  title?: string
  alt?: string
  chapterId?: string
  characterId?: string
  expression?: string
  sceneId?: string
  state?: string
  duration?: number
  loop?: boolean
  frameWidth?: number
  frameHeight?: number
  frames?: number
  fps?: number
  /** Human-readable SPDX expression or project content-license identifier. */
  license?: string
  source?: AdvAssetProvenance
}

/** Shared metadata for inline and split authoring catalogs. */
export interface AdvAssetManifestBase {
  schemaVersion: 2
  id: string
  defaultProfile: string
  profiles: Record<string, AdvAssetProfile>
  bundles?: AdvAssetBundle[]
  release?: {
    provider: 'tencent-cos' | string
    objectPrefix: string
  }
  /** Stable published manifest key; uploaded after all immutable artifacts. */
  manifestObjectKey?: string
}

/**
 * Flattened ADV.JS addressable asset catalog.
 *
 * Authoring files and published artifacts share one stable ID. Profiles select
 * the location adapter; bundles describe loading units without changing IDs.
 * This is also the normalized form consumed by runtime loaders and emitted to
 * build/release output.
 */
export interface AdvAssetManifest extends AdvAssetManifestBase {
  assets: AdvAssetEntry[]
  includes?: never
}

/** Split authoring form of the canonical `adv/assets.json` root. */
export interface AdvAssetManifestIncludes extends AdvAssetManifestBase {
  includes: string[]
  assets?: never
}

export type AdvAssetManifestSource = AdvAssetManifest | AdvAssetManifestIncludes

/** @deprecated Read-only compatibility name for legacy `adv/assets/index.json`. */
export type AdvAssetManifestIndex = AdvAssetManifestIncludes

export interface AdvAssetManifestFragment {
  schemaVersion: 2
  assets: AdvAssetEntry[]
}

export interface AdvAssetResolveRequest {
  provider: AdvAssetProvider
  profile: string
  location: string
  baseUrl?: string
  asset: AdvAssetEntry
  variant?: string
}

/** Adapter at the project/HTTP location seam. */
export interface AdvAssetLocationAdapter {
  resolve: (request: AdvAssetResolveRequest) => Promise<string> | string
  dispose?: () => void
}

export interface AdvResolvedAsset {
  id: string
  kind: string
  type: AdvAssetType
  bundle?: string
  variant?: string
  src: string
  sha256?: string
  bytes?: number
  mimeType?: string
  width?: number
  height?: number
}
