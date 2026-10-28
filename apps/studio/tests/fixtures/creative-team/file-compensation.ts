import type { StudioNativeFileChange } from '../../../src/utils/nativeProjectMutation'
import { createStudioCreativeWorkspace } from '../../../src/utils/creativeTeamWorkspace'
import { BrowserFsAdapter } from '../../../src/utils/fs/BrowserFsAdapter'
import { commitStudioProjectFiles } from '../../../src/utils/nativeProjectMutation'

let fs: BrowserFsAdapter
let name: string
let release: (() => void) | undefined
let result: { status: 'idle' | 'writing' | 'waiting' | 'failed' | 'succeeded', error?: string, cause?: string, details?: string[] } = { status: 'idle' }
let completion: Promise<void> | undefined

Object.assign(window, { fileCompensationFixture: {
  async open(id: string) {
    if (!/^[a-z0-9-]+$/.test(id))
      throw new Error('Fixture project ID required')
    name = `advjs-file-compensation-${id}`
    fs = new BrowserFsAdapter(await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true }))
    document.querySelector('#state')!.textContent = `Actual ${fs.backend} filesystem: ${name}`
  },
  async write(files: Record<string, string>) {
    for (const [path, text] of Object.entries(files))
      await fs.writeFile(path, text)
  },
  async writeBinary(path: string, bytes: number[]) {
    await fs.writeBlob(path, new Blob([new Uint8Array(bytes)]))
  },
  async read(path: string) { return await fs.exists(path) ? fs.readFile(path) : null },
  async readBinary(path: string) { return await fs.exists(path) ? Array.from(new Uint8Array(await (await fs.readBlob(path)).arrayBuffer())) : null },
  async files() { return Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])) },
  async start(changes: StudioNativeFileChange[], mode: 'after-writes' | 'between-writes', bytes: number[] = []) {
    const workspace = createStudioCreativeWorkspace(fs, name)
    const before = await workspace.snapshot()
    const gate = new Promise<void>(resolve => release = resolve)
    const write = fs.writeFile.bind(fs)
    if (mode === 'between-writes') {
      fs.writeFile = async (path, content) => {
        await write(path, content)
        if (path === changes[0]?.path && content === changes[0]?.content) {
          result.status = 'waiting'
          await gate
        }
      }
    }
    const data = new Uint8Array(bytes)
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0')).join('')
    result = { status: 'writing' }
    completion = commitStudioProjectFiles(fs, changes, {
      acceptsPath: path => path.startsWith('adv/'),
      ...(bytes.length ? { media: { path: 'adv/assets/import.bin', blob: new Blob([data]), sha256, bytes: bytes.length } } : {}),
      async validateCurrent(scope) {
        if ((await createStudioCreativeWorkspace(scope, name).snapshot()).revision !== before.revision)
          throw new Error('FIXTURE_SAVED_SOURCE_CHANGED')
      },
      async validateAfter() {
        if (mode === 'after-writes') {
          result.status = 'waiting'
          await gate
        }
        throw new Error('Explicit fixture failure after native writes')
      },
    }).then(() => { result = { status: 'succeeded' } }, (error) => {
      result = { status: 'failed', error: String(error), cause: String(error.cause ?? ''), ...(error instanceof AggregateError ? { details: error.errors.map(String) } : {}) }
    }).finally(() => { fs.writeFile = write })
  },
  state: () => result,
  async continue() {
    release?.()
    await completion
    return result
  },
  async cleanup() {
    if (!name)
      throw new Error('Fixture ownership unavailable')
    const storage = await navigator.storage.getDirectory()
    await storage.removeEntry(name, { recursive: true })
    try {
      await storage.getDirectoryHandle(name)
      throw new Error('Fixture directory still exists')
    }
    catch (error) {
      if ((error as { name?: string })?.name !== 'NotFoundError')
        throw error
    }
    return true
  },
} })
