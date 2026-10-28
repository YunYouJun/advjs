import type { IFileSystem } from '../utils/fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContentDelete } from '../composables/useContentDelete'

const state = vi.hoisted(() => ({ fs: null as IFileSystem | null, projectId: 'original', create: vi.fn(), toast: vi.fn(), reload: vi.fn() }))
vi.mock('@ionic/vue', () => ({ alertController: { create: state.create } }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => ({ getFs: () => state.fs, reload: state.reload }) }))
vi.mock('../utils/projectScope', () => ({ getCurrentProjectId: () => state.projectId }))
vi.mock('../utils/toast', () => ({ showToast: state.toast }))

function fixture() {
  const path = 'adv/characters/lin.character.md'
  const files: Record<string, string> = { [path]: 'Original author character' }
  const fs = {
    backend: 'browser',
    exists: async (path: string) => Object.hasOwn(files, path),
    readFile: vi.fn(async (path: string) => files[path]!),
    writeFile: vi.fn(async (path: string, content: string) => { files[path] = content }),
    deleteFile: vi.fn(async (path: string) => { delete files[path] }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  let confirm!: (value: { role?: string }) => void
  const dismiss = new Promise<{ role?: string }>((resolve) => {
    confirm = resolve
  })
  const present = vi.fn(async () => {})
  state.create.mockResolvedValue({ present, onDidDismiss: () => dismiss })
  state.fs = fs
  return { fs, files, path, confirm, present, remove: () => useContentDelete().deleteFile(path, 'Delete original character?') }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.projectId = 'original'
})

describe('author deletion confirmation scope', () => {
  it('preserves a file changed while its delete dialog was open', async () => {
    const f = fixture()
    const pending = f.remove()
    await vi.waitFor(() => expect(f.present).toHaveBeenCalled())
    f.files[f.path] = 'A newly adopted character'
    f.confirm({ role: 'destructive' })
    expect(await pending).toBe(false)
    expect(f.files[f.path]).toBe('A newly adopted character')
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
    expect(state.reload).not.toHaveBeenCalled()
  })

  it('never redirects an old delete confirmation to the newly active filesystem', async () => {
    const f = fixture()
    const pending = f.remove()
    await vi.waitFor(() => expect(f.present).toHaveBeenCalled())
    const other = { ...f.fs, deleteFile: vi.fn() }
    state.fs = other
    state.projectId = 'other'
    f.confirm({ role: 'destructive' })
    expect(await pending).toBe(false)
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
    expect(other.deleteFile).not.toHaveBeenCalled()
  })

  it.each([undefined, 'cancel', 'backdrop', 'escape'])('does not delete for dismissal role %s', async (role) => {
    const f = fixture()
    const pending = f.remove()
    await vi.waitFor(() => expect(f.present).toHaveBeenCalled())
    f.confirm({ role })
    expect(await pending).toBe(false)
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
  })

  it('reports success only after the confirmed deletion is durable', async () => {
    const f = fixture()
    let release!: () => void
    vi.mocked(f.fs.flush!).mockReturnValueOnce(new Promise<void>((resolve) => {
      release = resolve
    }))
    const pending = f.remove()
    await vi.waitFor(() => expect(f.present).toHaveBeenCalled())
    f.confirm({ role: 'destructive' })
    await vi.waitFor(() => expect(f.fs.flush).toHaveBeenCalled())
    expect(state.reload).not.toHaveBeenCalled()
    release()
    expect(await pending).toBe(true)
    expect(f.files[f.path]).toBeUndefined()
    expect(state.reload).toHaveBeenCalledOnce()
  })

  it('restores a deleted source when persistence fails and reports failure', async () => {
    const f = fixture()
    vi.mocked(f.fs.flush!).mockRejectedValueOnce(new Error('Storage failed'))
    const pending = f.remove()
    await vi.waitFor(() => expect(f.present).toHaveBeenCalled())
    f.confirm({ role: 'destructive' })
    expect(await pending).toBe(false)
    expect(f.files[f.path]).toBe('Original author character')
    expect(state.reload).not.toHaveBeenCalled()
  })

  it('does not open an actionable delete dialog for an unreadable source', async () => {
    const f = fixture()
    vi.mocked(f.fs.readFile).mockRejectedValueOnce(new Error('Permission unknown'))
    expect(await f.remove()).toBe(false)
    expect(state.create).not.toHaveBeenCalled()
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
  })
})
