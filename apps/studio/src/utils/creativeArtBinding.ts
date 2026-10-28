import type { CreativeArtRequest } from '@advjs/agent'
import type { AdvAssetEntry, NormalizedAdvProject } from '@advjs/types'

/** Check the same compiled binding for adoption and saved-project inspection. */
export function matchesCreativeArtBinding(project: NormalizedAdvProject, request: CreativeArtRequest, asset: AdvAssetEntry): boolean {
  if (asset.type !== 'image' || asset.state === 'rejected')
    return false
  if (request.kind === 'background') {
    const scene = project.scenes.find(item => item.id === request.sceneId)
    return asset.kind === 'background' && asset.sceneId === request.sceneId && scene?.assetId === asset.id
  }
  return asset.kind === 'character' && asset.characterId === request.characterId
    && project.characters.some(item => item.id === request.characterId)
    && asset.expression === (request.kind === 'expression' ? request.expression : 'default')
}
