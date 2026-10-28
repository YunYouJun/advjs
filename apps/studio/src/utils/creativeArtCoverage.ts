import type { CreativeArtRequest, CreativeTeamRun } from '@advjs/agent'
import type { AdvProjectDiagnostic } from '@advjs/types'
import type { IFileSystem } from './fs'
import { creativeArtifactExpectedFiles } from '@advjs/agent'
import { audioProjectMediaPath } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { matchesCreativeArtBinding } from './creativeArtBinding'
import { inspectCreativeImage } from './creativeImage'
import { createStudioCreativeWorkspace } from './creativeTeamWorkspace'
import { studioFileMutationRevision, whenStudioFileMutationsSettle } from './fs/mutations'
import { whenStudioProjectWritesSettle } from './projectAudio'

export type CreativeArtCoverageStatus = 'missing' | 'stale' | 'binding' | 'unavailable' | 'ready'
export interface CreativeArtCoverageRow {
  artifactId: string
  request: CreativeArtRequest
  status: CreativeArtCoverageStatus
  path?: string
  sha256?: string
  width?: number
  height?: number
}
export interface CreativeArtCoverage {
  revision: string
  complete: boolean
  diagnostics: AdvProjectDiagnostic[]
  rows: CreativeArtCoverageRow[]
}

/** Read actual project sources and decoded bytes; private candidates never satisfy a request. */
export async function readCreativeArtCoverage(fs: IFileSystem, run: CreativeTeamRun, assertCurrent: () => void, inspectImage = inspectCreativeImage): Promise<CreativeArtCoverage> {
  await whenStudioProjectWritesSettle(fs)
  await whenStudioFileMutationsSettle(fs)
  const mutation = studioFileMutationRevision(fs)
  const check = () => {
    assertCurrent()
    if (mutation !== studioFileMutationRevision(fs))
      throw new Error('CREATIVE_ART_SOURCE_CHANGED')
  }
  const workspace = createStudioCreativeWorkspace(fs, run.plan.projectId, { assertCurrent: check })
  const source = await workspace.snapshot()
  const compiled = await compileProject({ id: run.plan.projectId, files: source.files }, { allowEmptyAssetManifest: true })
  check()
  const rows: CreativeArtCoverageRow[] = []
  for (const artifact of run.artifacts) {
    if (artifact.output?.kind !== 'art-direction' || !['selected', 'adopted', 'stale'].includes(artifact.status))
      continue
    const stale = artifact.status === 'stale' || Object.entries(creativeArtifactExpectedFiles(artifact, run)).some(([path, content]) => (source.files[path] ?? null) !== content)
    for (const request of artifact.output.requests) {
      const asset = compiled.project.assets?.assets.find(item => item.id === request.assetId)
      const row: CreativeArtCoverageRow = { artifactId: artifact.id, request, status: stale ? 'stale' : !asset ? 'missing' : 'binding' }
      if (asset && matchesCreativeArtBinding(compiled.project, request, asset)) {
        try {
          row.path = audioProjectMediaPath(compiled.project.assets!, asset)
          row.sha256 = asset.sha256
          row.width = asset.width
          row.height = asset.height
          if (!Number.isSafeInteger(asset.bytes) || !(asset.bytes! > 0 && asset.bytes! <= 20 * 1024 * 1024))
            throw new Error('CREATIVE_IMAGE_SIZE')
          const blob = await fs.readBlob(row.path)
          if (blob.size !== asset.bytes)
            throw new Error('CREATIVE_IMAGE_SIZE')
          const { image } = await inspectImage(blob)
          if (image.sha256 !== asset.sha256 || image.mimeType !== asset.mimeType || image.width !== asset.width || image.height !== asset.height)
            throw new Error('CREATIVE_IMAGE_BYTES_CHANGED')
          row.status = stale ? 'stale' : 'ready'
        }
        catch {
          row.status = stale ? 'stale' : 'unavailable'
        }
      }
      check()
      rows.push(row)
    }
  }
  if ((await workspace.snapshot()).revision !== source.revision)
    throw new Error('CREATIVE_ART_SOURCE_CHANGED')
  check()
  return { revision: source.revision, complete: !compiled.diagnostics.some(item => item.severity === 'error'), diagnostics: compiled.diagnostics, rows }
}
