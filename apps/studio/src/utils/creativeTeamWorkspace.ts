import type { CreativeProjectWorkspace } from '@advjs/agent'
import type { IFileSystem } from './fs'
import { assertCreativeSourcePath, computeAgentProjectRevision, createCreativePlaytestVoiceCoverage, overlayCreativeChanges, selectCreativeProjectFiles } from '@advjs/agent'
import { compileProject } from '@advjs/core'
import { commitStudioProjectFiles } from './nativeProjectMutation'

/** Share Studio's native transaction with voice/Flow writes; media authority is explicit. */
export function createStudioCreativeWorkspace(fs: IFileSystem, projectId: string, options: {
  assertCurrent?: () => void
  verifyMedia?: CreativeProjectWorkspace['verifyMedia']
} = {}): CreativeProjectWorkspace {
  async function snapshot() {
    options.assertCurrent?.()
    const files = selectCreativeProjectFiles(Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])))
    options.assertCurrent?.()
    const revision = await computeAgentProjectRevision(files)
    options.assertCurrent?.()
    return { projectId, files, revision }
  }
  return {
    snapshot,
    async inspectVoiceCoverage(source, signal) {
      if (source.projectId !== projectId)
        throw new Error('CREATIVE_VOICE_PROJECT_CHANGED')
      const before = await snapshot()
      const assertCurrent = () => {
        options.assertCurrent?.()
        if (signal?.aborted)
          throw new Error('CREATIVE_VOICE_CHECK_CANCELLED')
      }
      const { inspectCreativeVoiceCoverage } = await import('./creativeVoiceCoverage')
      const result = await inspectCreativeVoiceCoverage(fs, projectId, source, assertCurrent)
      if ((await snapshot()).revision !== before.revision)
        throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
      return createCreativePlaytestVoiceCoverage({ snapshotRevision: source.revision, locale: result.locale, complete: result.complete, rows: result.rows.map(({ address, lineId, speakerId, path, line, status, takes, profileMissing, selected }) => ({ address, ...(lineId ? { lineId } : {}), speakerId, ...(path ? { source: { path, ...(line ? { line } : {}) } } : {}), status, takes, profileMissing, ...(selected ? { selected } : {}) })) })
    },
    ...(options.verifyMedia ? { verifyMedia: options.verifyMedia } : {}),
    capabilities: ['create-source', 'modify-source', 'delete-source', 'candidate-preview', 'voice-settings', ...(options.verifyMedia ? ['catalog-media', 'voice-take'] as const : [])],
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
          if (changes.some(change => /^adv\/audio\/(?:pronunciation|voice-profiles)\.json$/.test(change.path))) {
            const result = await compileProject({ id: projectId, files }, { allowEmptyAssetManifest: true })
            if (result.diagnostics.some(item => item.severity === 'error'))
              throw new Error('CREATIVE_COMPILE_FAILED')
          }
          if (changes.some(change => /^adv\/(?:assets(?:\/|\.json$)|audio\/)/.test(change.path) && !/^adv\/audio\/(?:pronunciation|voice-profiles)\.json$/.test(change.path))) {
            if (!options.verifyMedia)
              throw new Error('CREATIVE_MEDIA_VERIFIER_REQUIRED')
            await options.verifyMedia(files, [])
          }
        },
      })
      return snapshot()
    },
  }
}
