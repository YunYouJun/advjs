import type { CreativeProjectWorkspace } from '@advjs/agent'
import type { IFileSystem } from './fs'
import { assertCreativeSourcePath, computeAgentProjectRevision, overlayCreativeChanges, selectCreativeProjectFiles } from '@advjs/agent'
import { commitStudioProjectFiles } from './nativeProjectMutation'

/** Share Studio's native transaction with voice/Flow writes; media authority is explicit. */
export function createStudioCreativeWorkspace(fs: IFileSystem, projectId: string, options: {
  assertCurrent?: () => void
  verifyMedia?: (files: Readonly<Record<string, string>>) => Promise<void>
} = {}): CreativeProjectWorkspace {
  async function snapshot() {
    options.assertCurrent?.()
    const files = selectCreativeProjectFiles(Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])))
    return { projectId, files, revision: await computeAgentProjectRevision(files) }
  }
  return {
    snapshot,
    capabilities: ['create-source', 'modify-source', 'delete-source', 'candidate-preview', ...(options.verifyMedia ? ['catalog-media', 'voice-take'] as const : [])],
    async commit(changes, expectedRevision) {
      await commitStudioProjectFiles(fs, changes.map(change => ({ path: change.path, expected: change.before, content: change.after })), {
        assertCurrent: options.assertCurrent,
        acceptsPath(path) {
          assertCreativeSourcePath(path)
          return true
        },
        async validateCurrent() {
          const current = await snapshot()
          if (current.revision !== expectedRevision)
            throw new Error('CREATIVE_SOURCE_CONFLICT')
          const files = overlayCreativeChanges(current.files, changes)
          if (changes.some(change => /^adv\/(?:assets(?:\/|\.json$)|audio\/)/.test(change.path))) {
            if (!options.verifyMedia)
              throw new Error('CREATIVE_MEDIA_VERIFIER_REQUIRED')
            await options.verifyMedia(files)
          }
        },
      })
      return snapshot()
    },
  }
}
