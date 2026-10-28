import type { CreativeFileChange } from '@advjs/agent'
import { useContentSave } from '../../../src/composables/useContentSave'
import { createStudioCreativeWorkspace } from '../../../src/utils/creativeTeamWorkspace'
import { db, dbReady } from '../../../src/utils/db'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import { observeStudioFileSystem } from '../../../src/utils/fs/mutations'

/** Actual adapters, IndexedDB and caller seams; no model or service transport. */
async function setup() {
  await dbReady
  let fs: MemoryFsAdapter
  let projectId: string
  let release: (() => void) | undefined
  let paused = false
  let adoption: Promise<{ success: boolean, error?: string }> | undefined
  Object.assign(window, { memoryFsFixture: {
    async open(id: string) {
      projectId = id
      fs = new MemoryFsAdapter(id)
      await fs.init()
      observeStudioFileSystem(fs)
    },
    async write(files: Record<string, string>) {
      for (const [path, content] of Object.entries(files))
        await fs.writeFile(path, content)
    },
    flush: () => fs.flush(),
    refresh: () => fs.refresh(),
    read: (path: string) => fs.readFile(path),
    exists: (path: string) => fs.exists(path),
    remove: (path: string) => fs.deleteFile(path),
    removeDirectory: (path: string) => fs.rmdir(path),
    snapshot: () => createStudioCreativeWorkspace(fs, projectId).snapshot(),
    adopt: (revision: string, changes: CreativeFileChange[]) => createStudioCreativeWorkspace(fs, projectId).commit(changes, revision),
    saveChapter: (content: string) => useContentSave().saveContent(fs, 'chapter', 'edit', { filename: 'intro', title: 'Intro', content }),
    writeMedia: (path: string, bytes: number[]) => fs.writeBlob(path, new Blob([new Uint8Array(bytes)], { type: 'audio/wav' })),
    async readMedia(path: string) {
      const blob = await fs.readBlob(path)
      return { bytes: [...new Uint8Array(await blob.arrayBuffer())], mimeType: blob.type }
    },
    pauseAdoption(revision: string, changes: CreativeFileChange[]) {
      const transaction = fs.transaction.bind(fs)
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      fs.transaction = async (operation, validate) => {
        fs.transaction = transaction
        await transaction(async (scope) => {
          await operation(scope)
          paused = true
          await gate
        }, validate)
      }
      adoption = createStudioCreativeWorkspace(fs, projectId).commit(changes, revision).then(() => ({ success: true }), error => ({ success: false, error: String(error) }))
    },
    adoptionPaused: () => paused,
    resumeAdoption() {
      release?.()
      return adoption
    },
    abortNextMediaWrite() {
      const fail = (_key: unknown, row: { key: string }) => {
        if (row.key.endsWith('/abort.wav')) {
          db.memfsNodes.hook('creating').unsubscribe(fail)
          throw new Error('fixture abort during real IndexedDB transaction')
        }
      }
      db.memfsNodes.hook('creating', fail)
    },
  } })
}
void setup()
