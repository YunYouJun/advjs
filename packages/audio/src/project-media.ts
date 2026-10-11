import type { AdvAssetEntry, AdvAssetManifest } from '@advjs/types'

/** Immutable media writes and selection use a bounded native project profile. */
export function audioProjectMediaPath(catalog: AdvAssetManifest, asset: AdvAssetEntry) {
  const profile = catalog.profiles[catalog.defaultProfile]
  if (profile?.provider !== 'project' || !asset.path)
    throw new Error('ADV_AUDIO_NATIVE_MEDIA_REQUIRED: A project profile and local media path are required')
  const root = profile.root === '.' ? '' : (profile.root ?? '').replace(/\/$/u, '')
  const path = [root, asset.path].filter(Boolean).join('/')
  if (!path || /^(?:[a-z]+:|\/|\\)/iu.test(path) || path.includes('\\') || path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
    throw new Error('ADV_AUDIO_MEDIA_PATH_INVALID: Media must stay inside the project')
  return path
}
