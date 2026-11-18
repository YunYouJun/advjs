import type { AudioProjectMedia } from '@advjs/audio'
import type { VoiceAuthoringAdapter } from '@advjs/types'
import type { IFileSystem } from './fs'
import type { StudioNativeMedia } from './nativeProjectMutation'
import { audioProjectMediaPath, createProjectAudioService, verifyVoiceCandidateBytes } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { commitStudioProjectFiles } from './nativeProjectMutation'
import { whenStudioProjectWritesSettle } from './projectWriteQueue'

// Keep existing imports working while the queue stays independent of its consumers.
export { runStudioProjectWrite, whenStudioProjectWritesSettle } from './projectWriteQueue'

async function textFiles(fs: IFileSystem): Promise<Record<string, string>> {
  return Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
}
async function savedFiles(fs: IFileSystem, validateAccess?: () => void) {
  await whenStudioProjectWritesSettle(fs)
  validateAccess?.()
  await fs.refresh?.()
  validateAccess?.()
  const files = await textFiles(fs)
  validateAccess?.()
  return files
}
async function assertFiles(fs: IFileSystem, expected: Readonly<Record<string, string>>) {
  const actual = await textFiles(fs)
  if (Object.keys(actual).length !== Object.keys(expected).length || Object.entries(expected).some(([path, content]) => actual[path] !== content))
    throw new Error('VOICE_CONFLICT: Saved project sources changed; reload before applying')
}
function audioWritablePath(path: string) {
  return !path.includes('\\') && !path.split('/').some(part => ['', '.', '..'].includes(part))
    && (path === 'adv/assets.json' || (path.startsWith('adv/assets/') && path.endsWith('.json')) || /^adv\/audio\/(?:voice-ledger|pronunciation|voice-profiles|mixer)\.json$/.test(path))
}

/** Explicit first use shares source CAS, durable transactions and compensation. */
export async function initializeStudioAudioCatalog(fs: IFileSystem, catalogId: string, options: { validateAccess?: () => void } = {}) {
  const before = await savedFiles(fs, options.validateAccess)
  if (await fs.exists('adv/assets.json'))
    throw new Error('VOICE_CONFLICT: The catalog already exists; reload before applying')
  if (await fs.exists('adv/assets/index.json'))
    throw new Error('ADV_AUDIO_LEGACY_MIGRATION_REQUIRED: Migrate the existing catalog before creating audio resources')
  const compilation = await compileProject({ files: before }, { allowEmptyAssetManifest: true })
  if (compilation.project.root !== 'adv')
    throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Audio authoring currently requires the canonical adv content root')
  const catalog = `${JSON.stringify({ schemaVersion: 2, id: catalogId, defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, includes: [] }, null, 2)}\n`
  const after: Record<string, string> = { ...before, 'adv/assets.json': catalog }
  if (!Object.hasOwn(before, 'adv.config.json'))
    after['adv.config.json'] = `${JSON.stringify({ schemaVersion: 1, id: catalogId, root: 'adv', format: 'adv-md' }, null, 2)}\n`
  await commitStudioProjectFiles(fs, Object.entries(after).filter(([path]) => !Object.hasOwn(before, path)).map(([path, content]) => ({ path, expected: null, content })), {
    assertCurrent: options.validateAccess,
    acceptsPath: path => path === 'adv/assets.json' || path === 'adv.config.json',
    validateCurrent: scope => assertFiles(scope, before),
    validateAfter: scope => assertFiles(scope, after),
  })
}

/** Same ledger and edit plans as Editor, committed through Studio's shared workspace. */
export function createStudioAudioService(fs: IFileSystem, synthesize?: VoiceAuthoringAdapter['synthesize'], options: { validateAccess?: () => void } = {}) {
  return createProjectAudioService({
    synthesize,
    async read() {
      const files = await savedFiles(fs, options.validateAccess)
      const compilation = await compileProject({ files }, { allowEmptyAssetManifest: true })
      options.validateAccess?.()
      if (compilation.project.root !== 'adv')
        throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Audio authoring currently requires the canonical adv content root')
      if (!compilation.project.assets)
        throw new Error('ADV_AUDIO_CATALOG_REQUIRED: Import an audio catalog first')
      return { files, catalog: compilation.project.assets, program: compilation.project.program }
    },
    async readMedia(path) {
      options.validateAccess?.()
      const data = await (await fs.readBlob(path)).arrayBuffer()
      options.validateAccess?.()
      return data
    },
    async verifySelection(take, asset, catalog) {
      options.validateAccess?.()
      const blob = await fs.readBlob(audioProjectMediaPath(catalog, asset))
      await verifyVoiceCandidateBytes({ sha256: take.sha256, bytes: asset.bytes }, await blob.arrayBuffer())
      options.validateAccess?.()
    },
    async commit(changes, media) {
      const before = await savedFiles(fs, options.validateAccess)
      const root = JSON.parse(before['adv/assets.json'] ?? '{}')
      const prepared: Array<AudioProjectMedia & { path: string }> = []
      const staged: StudioNativeMedia[] = []
      for (const item of media) {
        const path = audioProjectMediaPath(root, item.asset)
        const blob = await fs.readBlob(item.candidate.path)
        await verifyVoiceCandidateBytes(item.candidate, await blob.arrayBuffer())
        options.validateAccess?.()
        prepared.push({ ...item, path })
        if (item.operation !== 'verify')
          staged.push({ path, blob, sha256: item.candidate.sha256, bytes: blob.size, exclusive: true })
      }
      const writes = changes.filter(change => change.content !== change.expected)
      const after = { ...before }
      for (const change of writes) {
        if (change.content === null)
          delete after[change.path]
        else
          after[change.path] = change.content
      }
      let initial = true
      await commitStudioProjectFiles(fs, writes, {
        assertCurrent: options.validateAccess,
        acceptsPath: audioWritablePath,
        acceptsMediaPath: path => staged.some(item => item.path === path),
        media: staged,
        async validateCurrent(scope) {
          await assertFiles(scope, before)
          // Read-only guards can exceed the mutation limit in larger projects.
          for (const change of changes) {
            const actual = await scope.exists(change.path) ? await scope.readFile(change.path) : null
            if (actual !== change.expected)
              throw new Error('VOICE_CONFLICT: Project files changed; reload before applying')
          }
          for (const item of prepared) {
            await verifyVoiceCandidateBytes(item.candidate, await (await scope.readBlob(item.candidate.path)).arrayBuffer())
            if (initial && item.operation !== 'verify' && await scope.exists(item.path))
              throw new Error('VOICE_AUDIO_EXISTS: Immutable audio cannot be overwritten')
          }
          initial = false
        },
        async validateAfter(scope) {
          await assertFiles(scope, after)
          for (const item of prepared)
            await verifyVoiceCandidateBytes(item.candidate, await (await scope.readBlob(item.path)).arrayBuffer())
        },
      })
    },
  })
}
