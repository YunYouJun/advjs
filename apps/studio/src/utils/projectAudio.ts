import type { VoiceAuthoringAdapter } from '@advjs/types'
import type { IFileSystem } from './fs'
import { audioProjectMediaPath, createProjectAudioService, verifyVoiceCandidateBytes } from '@advjs/audio'
import { compileProject } from '@advjs/core'

const pendingWrites = new WeakMap<IFileSystem, Promise<void>>()

/** Serialize native authoring writes against audio imports in the same project. */
export async function runStudioProjectWrite<T>(fs: IFileSystem, operation: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(fs) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(operation)
  pendingWrites.set(fs, next.then(() => {}, () => {}))
  return await next
}

/** Explicit first-use action; never replace an existing native or legacy catalog. */
export async function initializeStudioAudioCatalog(fs: IFileSystem, catalogId: string) {
  const previous = pendingWrites.get(fs) ?? Promise.resolve()
  const operation = previous.catch(() => {}).then(async () => {
    if (await fs.exists('adv/assets.json'))
      throw new Error('VOICE_CONFLICT: The catalog already exists; reload before applying')
    if (await fs.exists('adv/assets/index.json'))
      throw new Error('ADV_AUDIO_LEGACY_MIGRATION_REQUIRED: Migrate the existing catalog before creating audio resources')
    const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
    const compilation = await compileProject({ files }, { allowEmptyAssetManifest: true })
    if (compilation.project.root !== 'adv')
      throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Audio authoring currently requires the canonical adv content root')
    const catalog = `${JSON.stringify({
      schemaVersion: 2,
      id: catalogId,
      defaultProfile: 'local',
      profiles: { local: { provider: 'project', root: 'adv/assets' } },
      includes: [],
    }, null, 2)}\n`
    const initializeConfig = !await fs.exists('adv.config.json')
    // QuickStart chat worlds predate the canonical project manifest. This
    // explicit author action establishes it so both hosts compile the project.
    await fs.writeFile('adv/assets.json', catalog)
    if (initializeConfig) {
      try {
        await fs.writeFile('adv.config.json', `${JSON.stringify({ schemaVersion: 1, id: catalogId, root: 'adv', format: 'adv-md' }, null, 2)}\n`)
      }
      catch (cause) {
        await fs.deleteFile('adv/assets.json')
        throw cause
      }
    }
  })
  pendingWrites.set(fs, operation)
  await operation
}

/** Same ledger, edit plans and selection conflicts as desktop Editor. */
export function createStudioAudioService(fs: IFileSystem, synthesize?: VoiceAuthoringAdapter['synthesize'], options: { validateAccess?: () => void } = {}) {
  return createProjectAudioService({
    synthesize,
    async read() {
      const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
      const compilation = await compileProject({ files }, { allowEmptyAssetManifest: true })
      if (compilation.project.root !== 'adv')
        throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Audio authoring currently requires the canonical adv content root')
      if (!compilation.project.assets)
        throw new Error('ADV_AUDIO_CATALOG_REQUIRED: Import an audio catalog first')
      return { files, catalog: compilation.project.assets, program: compilation.project.program }
    },
    async readMedia(path) {
      return await (await fs.readBlob(path)).arrayBuffer()
    },
    async verifySelection(take, asset, catalog) {
      const blob = await fs.readBlob(audioProjectMediaPath(catalog, asset))
      await verifyVoiceCandidateBytes({ sha256: take.sha256, bytes: asset.bytes }, await blob.arrayBuffer())
    },
    async commit(changes, media) {
      const previous = pendingWrites.get(fs) ?? Promise.resolve()
      const operation = previous.catch(() => {}).then(async () => {
        options.validateAccess?.()
        for (const change of changes) {
          const current = await fs.exists(change.path) ? await fs.readFile(change.path) : null
          if (current !== change.expected)
            throw new Error('VOICE_CONFLICT: Project files changed; reload before applying')
        }
        const imported: string[] = []
        const written: typeof changes = []
        try {
          const root = JSON.parse(await fs.readFile('adv/assets.json'))
          for (const item of media) {
            if (!item.asset.path)
              throw new Error('ADV_AUDIO_NATIVE_MEDIA_REQUIRED')
            const path = audioProjectMediaPath(root, item.asset)
            const blob = await fs.readBlob(item.candidate.path)
            await verifyVoiceCandidateBytes(item.candidate, await blob.arrayBuffer())
            if (item.operation === 'verify')
              continue
            if (await fs.exists(path))
              throw new Error('VOICE_AUDIO_EXISTS: Immutable audio cannot be overwritten')
            options.validateAccess?.()
            await fs.writeBlob(path, blob)
            imported.push(path)
            options.validateAccess?.()
          }
          for (const change of changes) {
            if (change.content === change.expected)
              continue
            options.validateAccess?.()
            if (change.content === null)
              await fs.deleteFile(change.path)
            else
              await fs.writeFile(change.path, change.content)
            written.push(change)
            options.validateAccess?.()
          }
        }
        catch (error) {
          for (const change of written.reverse()) {
            if (change.expected === null)
              await fs.deleteFile(change.path)
            else
              await fs.writeFile(change.path, change.expected)
          }
          for (const path of imported.reverse())
            await fs.deleteFile(path)
          throw error
        }
      })
      pendingWrites.set(fs, operation)
      await operation
    },
  })
}
