import { audioProjectMediaPath } from '@advjs/audio'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import { createStudioAudioService } from '../../../src/utils/projectAudio'

/** Seed the genuine native project, including immutable historical media. */
async function main() {
  const fs = new MemoryFsAdapter('design-flow-project')
  await fs.init()
  if (!await fs.exists('adv.config.json')) {
    const files: Record<string, string> = await fetch('/fixture/files').then(response => response.json())
    for (const [path, content] of Object.entries(files))
      await fs.writeFile(path, content)
    const media: Array<{ assetId: string, path: string, sha256: string, bytes: number, mimeType: string }> = await fetch('/fixture/media').then(response => response.json())
    for (const item of media) {
      const response = await fetch(`/fixture/media/${encodeURIComponent(item.assetId)}`)
      if (!response.ok)
        throw new Error('REAL_QWEN_NATIVE_MEDIA_MISSING')
      const bytes = await response.arrayBuffer()
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
      if (bytes.byteLength !== item.bytes || sha256 !== item.sha256)
        throw new Error('REAL_QWEN_NATIVE_MEDIA_CHANGED')
      await fs.writeBlob(item.path, new Blob([bytes], { type: item.mimeType }))
    }
    await fs.persist()
  }
  // The existing fixture composes the actual Studio workspaces, authoring FS,
  // managed HTTP session, jobs and ZIP exporter. No alternate domain protocol.
  await import('../design-flow/main')
  Object.assign(window, { realQwenFixture: {
    // This fixture authors only its own audit document, after the resource was
    // actually imported and hashed by the production Studio resource workflow.
    recordReference: async (input: { assetId: string, sampleAssetId: string, sha256: string }) => {
      const project = useProjectContent()
      await project.whenReady()
      const native = project.getFs()!
      const metadata = await fetch('/fixture/metadata').then(response => response.json())
      const snapshot = await createStudioAudioService(native).read()
      const asset = snapshot.catalog.assets.find(asset => asset.id === input.assetId)
      const sample = snapshot.catalog.assets.find(asset => asset.id === input.sampleAssetId)
      if (!asset || asset.kind !== 'reference' || asset.sha256 !== input.sha256 || sample?.sha256 !== input.sha256)
        throw new Error('REAL_QWEN_REFERENCE_PROVENANCE_CHANGED')
      const bytes = await native.readBlob(audioProjectMediaPath(snapshot.catalog, asset)).then(blob => blob.arrayBuffer())
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
      if (sha256 !== input.sha256)
        throw new Error('REAL_QWEN_REFERENCE_PROVENANCE_CHANGED')
      const prior = JSON.parse(await native.readFile(metadata.rightsPath))
      await native.writeFile(metadata.rightsPath, `${JSON.stringify({ ...prior, reference: { assetId: asset.id, sha256, bytes: bytes.byteLength, originalSampleAssetId: sample.id, model: metadata.models.design.model, revision: metadata.models.design.revision } }, null, 2)}\n`)
    },
  } })
}
void main().catch(error => document.body.textContent = String(error))
