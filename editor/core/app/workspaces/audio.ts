import type { VoiceAuthoringAdapter } from '@advjs/types'
import type { ProjectFileChange, ProjectWorkspace } from './project'
import { audioProjectMediaPath, createProjectAudioService, verifyVoiceCandidateBytes } from '@advjs/audio'
import { compileProject } from '@advjs/core'

/** All authoring changes use the Editor's existing finite workspace transaction. */
export function createEditorAudioService(workspace: ProjectWorkspace, synthesize?: VoiceAuthoringAdapter['synthesize'], writeFiles?: (changes: ProjectFileChange[]) => Promise<unknown>) {
  async function read() {
    const documents = workspace.readDocuments ? await workspace.readDocuments() : undefined
    const project = documents ? undefined : (await workspace.snapshot()).project
    const files = documents?.files ?? project!.files
    const catalog = documents?.catalog ?? project?.compilation.project.assets
    const compilation = documents ? await compileProject({ files }, { allowEmptyAssetManifest: true }) : project!.compilation
    if (compilation.project.root !== 'adv')
      throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Audio authoring currently requires the canonical adv content root')
    if (!catalog)
      throw new Error('ADV_AUDIO_CATALOG_REQUIRED: Import an audio catalog first')
    return { files, catalog, program: compilation.project.program }
  }
  return createProjectAudioService({
    synthesize,
    read,
    async readMedia(path) {
      if (!workspace.readAsset)
        throw new Error('ADV_AUDIO_NATIVE_MEDIA_REQUIRED')
      return await (await workspace.readAsset(path)).arrayBuffer()
    },
    async verifySelection(take, asset, catalog) {
      if (!workspace.readAsset)
        throw new Error('ADV_AUDIO_NATIVE_MEDIA_REQUIRED')
      const blob = await workspace.readAsset(audioProjectMediaPath(catalog, asset))
      await verifyVoiceCandidateBytes({ sha256: take.sha256, bytes: asset.bytes }, await blob.arrayBuffer())
    },
    async commit(changes, media) {
      const write = writeFiles ?? workspace.writeFiles
      if (!write)
        throw new Error('ADV_AUDIO_WORKSPACE_READ_ONLY')
      const { catalog } = await read()
      const imported: Array<{ path: string, blob: Blob }> = []
      try {
        for (const item of media) {
          if (!workspace.readAsset || !item.asset.path)
            throw new Error('ADV_AUDIO_NATIVE_MEDIA_REQUIRED')
          const blob = await workspace.readAsset(item.candidate.path)
          await verifyVoiceCandidateBytes(item.candidate, await blob.arrayBuffer())
          if (item.operation === 'verify')
            continue
          if (!workspace.importAsset)
            throw new Error('ADV_AUDIO_NATIVE_MEDIA_REQUIRED')
          const path = audioProjectMediaPath(catalog, item.asset)
          await workspace.importAsset(path, blob)
          imported.push({ path, blob })
        }
        await write(changes)
      }
      catch (error) {
        for (const item of imported.reverse())
          await workspace.removeImportedAsset?.(item.path, item.blob)
        throw error
      }
    },
  })
}
