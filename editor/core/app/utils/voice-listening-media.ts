import type { AdvAssetManifest, VoiceTake } from '@advjs/types'
import type { ProjectWorkspace } from '../workspaces/project'
import { audioProjectMediaPath, verifyVoiceCandidateBytes } from '@advjs/audio'

const MAX_LISTENING_BYTES = 64 * 1024 * 1024

/** Auditions use registered native masters; the workspace owns all filesystem access. */
export async function readVerifiedVoiceTake(workspace: ProjectWorkspace, catalog: AdvAssetManifest, take: Pick<VoiceTake, 'assetId' | 'sha256'>) {
  const asset = catalog.assets.find(asset => asset.id === take.assetId)
  if (!workspace.readAsset || !asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.state === 'rejected' || asset.sha256 !== take.sha256)
    throw new Error('ADV_AUDIO_TAKE_UNAVAILABLE: Restore the registered native voice master before listening')
  if (asset.bytes !== undefined && asset.bytes > MAX_LISTENING_BYTES)
    throw new Error('ADV_AUDIO_LISTENING_TOO_LARGE: The voice master exceeds the 64 MiB listening limit')
  const blob = await workspace.readAsset(audioProjectMediaPath(catalog, asset))
  if (blob.size > MAX_LISTENING_BYTES)
    throw new Error('ADV_AUDIO_LISTENING_TOO_LARGE: The voice master exceeds the 64 MiB listening limit')
  try {
    await verifyVoiceCandidateBytes({ sha256: take.sha256, bytes: asset.bytes }, await blob.arrayBuffer())
  }
  catch {
    throw new Error('ADV_AUDIO_MEDIA_HASH_MISMATCH: The registered voice master changed; restore its original bytes')
  }
  return blob
}
