import { createFileSystem } from '../../../src/utils/fs'
import { commitStudioProjectFiles } from '../../../src/utils/nativeProjectMutation'
import { whenStudioProjectWritesSettle } from '../../../src/utils/projectWriteQueue'
import { commitWorkspaceFileMutation, recoverWorkspaceFileMutation, reviewWorkspaceMutation } from '../../../src/utils/workspaceFileMutation'
import { snapshotWorkspaceFiles } from '../../../src/utils/workspaceFileSnapshot'
import { listWorkspaceMutationRecords } from '../../../src/utils/workspaceMutationJournal'

async function initialize() {
  const id = new URLSearchParams(location.search).get('id')!
  if (!/^[a-z0-9-]+$/i.test(id))
    throw new Error('Invalid isolated fixture ID')
  const rootName = `advjs-native-write-lock-${id}`
  const projectId = new URLSearchParams(location.search).has('alias') ? `${id}-alias` : id
  const storage = await navigator.storage.getDirectory()
  const root = await storage.getDirectoryHandle(rootName, { create: true })
  const fs = await createFileSystem({ dirHandle: root, projectId })
  if (!await fs.exists('README.md'))
    await fs.writeFile('README.md', 'Original author source\n')

  let release: (() => void) | undefined
  let state = { phase: 'idle', error: '', writes: 0 }
  let running: Promise<void> | undefined
  function pause() {
    state.phase = 'paused'
    return new Promise<void>((resolve) => {
      release = resolve
    })
  }
  function track(operation: () => Promise<unknown>) {
    if (running)
      throw new Error('Fixture operation already active')
    state = { phase: 'queued', error: '', writes: 0 }
    running = operation().then(() => {
      state.phase = 'saved'
    }, (error) => {
      state.phase = 'failed'
      state.error = error instanceof Error ? error.message : String(error)
    }).finally(() => { running = undefined })
  }
  const write = fs.writeFile.bind(fs)
  let writePause: 'before' | 'after-fail' | undefined
  fs.writeFile = async (path, content) => {
    state.writes++
    const mode = writePause
    writePause = undefined
    if (mode === 'before')
      await pause()
    await write(path, content)
    if (mode === 'after-fail') {
      await pause()
      throw new Error('Explicit native failure after close')
    }
  }
  const remove = fs.deleteFile.bind(fs)
  let pauseDelete = false
  fs.deleteFile = async (path) => {
    await remove(path)
    if (pauseDelete) {
      pauseDelete = false
      await pause()
    }
  }

  Object.assign(window, { nativeWriteLockFixture: {
    state: () => ({ ...state }),
    read: async () => await fs.exists('README.md') ? fs.readFile('README.md') : null,
    startSave(content: string, mode?: typeof writePause) {
      writePause = mode
      track(() => commitStudioProjectFiles(fs, [{ path: 'README.md', expected: 'Original author source\n', content }], { acceptsPath: path => path === 'README.md' }))
    },
    wait() { track(() => whenStudioProjectWritesSettle(fs)) },
    release() {
      release?.()
      release = undefined
    },
    async startDelete() {
      const before = await snapshotWorkspaceFiles(fs, ['README.md'], () => {})
      const bytes = before.reduce((total, entry) => total + (entry.data?.byteLength ?? 0), 0)
      pauseDelete = true
      track(() => commitWorkspaceFileMutation(fs, async () => ({ id: crypto.randomUUID(), projectId, root, kind: 'delete', createdAt: Date.now(), roots: ['README.md'], before, after: [], drafts: [], bytes }), { check: () => {} }))
    },
    records: () => listWorkspaceMutationRecords(projectId, root),
    async restore() {
      const [record] = await listWorkspaceMutationRecords(projectId, root)
      if (!record)
        throw new Error('Expected durable original')
      const review = await reviewWorkspaceMutation(fs, record, () => {})
      await recoverWorkspaceFileMutation(fs, record, review, 'restore', { check: () => {} })
    },
    async cleanup() {
      release?.()
      await running
      if ((await listWorkspaceMutationRecords(projectId, root)).length)
        throw new Error('Fixture still owns a durable recovery original')
      await storage.removeEntry(rootName, { recursive: true })
      return { removed: true }
    },
  } })
}

void initialize()
