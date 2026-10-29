import type { WorkspaceTextScope } from '../composables/useWorkspaceTextEditor'
import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { useWorkspaceTextEditor } from '../composables/useWorkspaceTextEditor'
import { readStudioContentSource } from '../utils/projectContentMutation'

function fixture() {
  const files: Record<string, string> = { 'README.md': '# Original README', 'adv/world.md': '# Original world' }
  const fs = {
    backend: 'browser',
    exists: async (path: string) => Object.hasOwn(files, path),
    readFile: vi.fn(async (path: string) => files[path]!),
    readBlob: vi.fn(async (path: string) => new NodeBlob([files[path]!])),
    writeFile: vi.fn(async (path: string, content: string) => { files[path] = content }),
    deleteFile: vi.fn(async (path: string) => { delete files[path] }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  const root = { isSameEntry: vi.fn(async () => true) } as unknown as FileSystemDirectoryHandle
  let scope: WorkspaceTextScope = { projectId: 'original', root, fs }
  const editor = useWorkspaceTextEditor(() => scope)
  return { files, fs, root, editor, setScope: (value: WorkspaceTextScope) => {
    scope = value
  } }
}

describe('workspace text author drafts', () => {
  it('opens an existing root README with the explicit text policy, retaining the default content restriction', async () => {
    const f = fixture()
    await expect(readStudioContentSource(f.fs, 'README.md', () => {})).rejects.toThrow('ADV_STUDIO_CONTENT_PATH_INVALID')
    expect(await f.editor.open('README.md')).toBe(true)
    f.editor.update('# Root author edit')
    expect(await f.editor.save()).toMatchObject({ success: true })
    expect(f.files['README.md']).toBe('# Root author edit')
  })

  it('preserves an independently saved version while retaining the old private draft', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Private old draft')
    f.files['README.md'] = '# Later author version'
    expect(await f.editor.save()).toMatchObject({ success: false, conflict: true })
    expect(f.files['README.md']).toBe('# Later author version')
    expect(f.editor.content.value).toBe('# Private old draft')
    expect(f.editor.isDirty.value).toBe(true)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('uses the submitted text as the receipt while later input stays dirty', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Submitted')
    let release!: () => void
    vi.mocked(f.fs.flush!).mockReturnValueOnce(new Promise<void>(resolve => release = resolve))
    const pending = f.editor.save()
    await vi.waitFor(() => expect(f.fs.flush).toHaveBeenCalled())
    expect(await f.editor.save()).toMatchObject({ success: false, error: 'ADV_STUDIO_CONTENT_SAVE_BUSY' })
    f.editor.update('# Later typing')
    release()
    expect(await pending).toMatchObject({ success: true, newerDraft: true })
    expect(f.files['README.md']).toBe('# Submitted')
    expect(f.editor.isDirty.value).toBe(true)
    expect(await f.editor.save()).toMatchObject({ success: true, newerDraft: false })
    expect(f.files['README.md']).toBe('# Later typing')
    expect(f.editor.isDirty.value).toBe(false)
  })

  it('never assigns an earlier file save receipt to the newly selected document', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Submitted README')
    let release!: () => void
    vi.mocked(f.fs.flush!).mockReturnValueOnce(new Promise<void>(resolve => release = resolve))
    const pending = f.editor.save()
    await vi.waitFor(() => expect(f.fs.flush).toHaveBeenCalled())
    const opening = f.editor.open('adv/world.md')
    release()
    expect(await pending).toMatchObject({ success: true })
    expect(await opening).toBe(true)
    expect(f.editor.path.value).toBe('adv/world.md')
    expect(f.editor.content.value).toBe('# Original world')
    expect(f.editor.isDirty.value).toBe(false)
    expect(f.files['README.md']).toBe('# Submitted README')
  })

  it('restores a dirty file with its original source rather than adopting a newer disk baseline', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Keep this private draft')
    await f.editor.open('adv/world.md')
    f.files['README.md'] = '# New saved README'
    expect(await f.editor.open('README.md')).toBe(true)
    expect(f.editor.content.value).toBe('# Keep this private draft')
    expect(await f.editor.save()).toMatchObject({ success: false, conflict: true })
    expect(f.files['README.md']).toBe('# New saved README')
  })

  it('retains old project input and rolls back its own in-flight save after switching scope', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Old project input')
    let release!: () => void
    vi.mocked(f.fs.flush!).mockReturnValueOnce(new Promise<void>(resolve => release = resolve))
    const pending = f.editor.save()
    await vi.waitFor(() => expect(f.fs.flush).toHaveBeenCalled())
    f.setScope({ projectId: 'other', root: f.root, fs: f.fs })
    f.editor.reset()
    release()
    expect(await pending).toMatchObject({ success: false, conflict: true })
    expect(f.files['README.md']).toBe('# Original README')
    // Recreating an adapter for the same verified directory keeps the original bytes.
    f.setScope({ projectId: 'original', root: { ...f.root }, fs: { ...f.fs } })
    expect(await f.editor.open('README.md')).toBe(true)
    expect(f.editor.content.value).toBe('# Old project input')
    expect(await f.editor.save()).toMatchObject({ success: true })
  })

  it('does not restore a private draft into another physical root with the same project ID', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# First directory private input')
    vi.mocked(f.root.isSameEntry).mockResolvedValue(false)
    f.setScope({ projectId: 'original', root: { ...f.root }, fs: { ...f.fs } })
    expect(await f.editor.open('README.md')).toBe(true)
    expect(f.editor.content.value).toBe('# Original README')
    expect(f.editor.isDirty.value).toBe(false)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('compensates a persistence failure and permits an explicit retry from the original source', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Keep after failure')
    vi.mocked(f.fs.flush!).mockRejectedValueOnce(new Error('Disk unavailable'))
    expect(await f.editor.save()).toMatchObject({ success: false })
    expect(f.files['README.md']).toBe('# Original README')
    expect(f.editor.content.value).toBe('# Keep after failure')
    expect(f.editor.isDirty.value).toBe(true)
    expect(await f.editor.save()).toMatchObject({ success: true })
  })

  it('does not expose an empty editable document after an unknown read', async () => {
    const f = fixture()
    vi.mocked(f.fs.readFile).mockRejectedValueOnce(new Error('Permission unknown'))
    expect(await f.editor.open('README.md')).toBe(false)
    expect(f.editor.isReady.value).toBe(false)
    f.editor.update('# Cannot write here')
    expect(await f.editor.save()).toMatchObject({ success: false })
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('discards a late file read while the newer document remains selected', async () => {
    const f = fixture()
    let release!: () => void
    vi.mocked(f.fs.readFile).mockImplementationOnce(() => new Promise<string>(resolve => release = () => resolve('# Late old file')))
    const old = f.editor.open('README.md')
    await vi.waitFor(() => expect(f.fs.readFile).toHaveBeenCalled())
    expect(await f.editor.open('adv/world.md')).toBe(true)
    release()
    expect(await old).toBe(false)
    expect(f.editor.path.value).toBe('adv/world.md')
    expect(f.editor.content.value).toBe('# Original world')
  })

  it.each(['draft', 'file', 'project'] as const)('rejects a stale reload confirmation after changing %s', async (change) => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Confirmed draft')
    const ticket = f.editor.captureReload()
    if (change === 'draft')
      f.editor.update('# Newer unconfirmed draft')
    if (change === 'file')
      await f.editor.open('adv/world.md')
    if (change === 'project')
      f.setScope({ projectId: 'other', root: f.root, fs: f.fs })
    expect(await f.editor.reload(ticket)).toBe(false)
    expect(f.files['README.md']).toBe('# Original README')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('reloads the actual author file only after an unchanged explicit discard ticket', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Discarded only after confirmation')
    const ticket = f.editor.captureReload()
    f.files['README.md'] = '# Actual new disk source'
    expect(await f.editor.reload(ticket)).toBe(true)
    expect(f.editor.content.value).toBe('# Actual new disk source')
    expect(f.editor.isDirty.value).toBe(false)
    f.editor.update('# Edit after explicit reread')
    expect(await f.editor.save()).toMatchObject({ success: true })
  })

  it.each(['../README.md', '/README.md', 'C:/README.md', 'adv/.git/key.json', 'adv/node_modules/a.ts', 'adv//a.md', 'adv/master.webp'])('refuses unsafe or binary text target %s', async (path) => {
    const f = fixture()
    expect(await f.editor.open(path)).toBe(false)
    expect(f.editor.isReady.value).toBe(false)
    expect(f.fs.readFile).not.toHaveBeenCalled()
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })
})

describe('workspace text format compatibility', () => {
  it.each(['LICENSE', 'style.scss', 'icon.svg', 'data.csv', 'app.jsx', 'app.tsx'])('keeps existing UTF-8 author file %s editable', async (path) => {
    const f = fixture()
    f.files[path] = 'Original UTF-8 source\n'
    expect(await f.editor.open(path)).toBe(true)
    f.editor.update('Explicit author edit\n')
    expect(await f.editor.save()).toMatchObject({ success: true })
    expect(f.files[path]).toBe('Explicit author edit\n')
  })

  it('rejects binary bytes under an unknown text-like filename', async () => {
    const f = fixture()
    f.files['unknown.data'] = '\uFFFD'
    vi.mocked(f.fs.readBlob).mockResolvedValue(new NodeBlob([new Uint8Array([255, 0, 1])]) as unknown as Blob)
    expect(await f.editor.open('unknown.data')).toBe(false)
    expect(f.editor.error.value).toBe('ADV_STUDIO_CONTENT_NOT_TEXT')
    expect(f.editor.isReady.value).toBe(false)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('rejects a saved source changing during the independent byte read', async () => {
    const f = fixture()
    vi.mocked(f.fs.readBlob).mockImplementationOnce(async () => {
      f.files['README.md'] = '# Independently changed during read'
      return new NodeBlob([f.files['README.md']]) as unknown as Blob
    })
    expect(await f.editor.open('README.md')).toBe(false)
    expect(f.editor.error.value).toBe('ADV_STUDIO_SOURCE_CONFLICT')
    expect(f.editor.isReady.value).toBe(false)
    expect(f.files['README.md']).toBe('# Independently changed during read')
  })
})

describe('workspace drafts following saved file moves', () => {
  it('moves the draft path and retains typing made while the saved file is moving', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Private input before moving')
    const ticket = await f.editor.prepareRelocation({ projectId: 'original', root: f.root, fs: f.fs }, [{ source: 'README.md', target: 'renamed.md', move: true }])
    expect(await f.editor.save()).toMatchObject({ success: false, error: 'ADV_STUDIO_CONTENT_SAVE_BUSY' })
    f.editor.update('# More typing during moving')
    f.files['renamed.md'] = f.files['README.md']!
    delete f.files['README.md']
    ticket.commit()
    ticket.release()
    expect(f.editor.path.value).toBe('renamed.md')
    expect(f.editor.content.value).toBe('# More typing during moving')
    expect(await f.editor.save()).toMatchObject({ success: true })
    expect(f.files['renamed.md']).toBe('# More typing during moving')
  })

  it('keeps the old byte baseline when another author saved before the move', async () => {
    const f = fixture()
    await f.editor.open('README.md')
    f.editor.update('# Private old input')
    f.files['renamed.md'] = '# Newer saved author version'
    delete f.files['README.md']
    const ticket = await f.editor.prepareRelocation({ projectId: 'original', root: f.root, fs: f.fs }, [{ source: 'README.md', target: 'renamed.md', move: true }])
    ticket.commit()
    ticket.release()
    expect(await f.editor.save()).toMatchObject({ success: false, conflict: true })
    expect(f.files['renamed.md']).toBe('# Newer saved author version')
    expect(f.editor.content.value).toBe('# Private old input')
  })

  it('rejects a move that would make two private drafts share one saved path', async () => {
    const f = fixture()
    f.files['renamed.md'] = '# Previously existing destination'
    await f.editor.open('renamed.md')
    f.editor.update('# Private destination')
    await f.editor.open('README.md')
    f.editor.update('# Private source')
    delete f.files['renamed.md']
    await expect(f.editor.prepareRelocation({ projectId: 'original', root: f.root, fs: f.fs }, [{ source: 'README.md', target: 'renamed.md', move: true }])).rejects.toThrow('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
    expect(f.editor.path.value).toBe('README.md')
    expect(f.editor.content.value).toBe('# Private source')
  })

  it('rebinds an in-flight file open only after its saved source move has finished', async () => {
    const f = fixture()
    let release!: () => void
    vi.mocked(f.fs.readFile).mockReturnValueOnce(new Promise<string>(resolve => release = () => resolve('# Original world')))
    const opening = f.editor.open('adv/world.md')
    await vi.waitFor(() => expect(f.fs.readFile).toHaveBeenCalled())
    const ticket = await f.editor.prepareRelocation({ projectId: 'original', root: f.root, fs: f.fs }, [{ source: 'adv', target: 'story', move: true }])
    f.files['story/world.md'] = f.files['adv/world.md']!
    delete f.files['adv/world.md']
    ticket.commit()
    release()
    expect(await opening).toBe(false)
    await ticket.after()
    ticket.release()
    expect(f.editor.path.value).toBe('story/world.md')
    expect(f.editor.content.value).toBe('# Original world')
    expect(f.editor.isReady.value).toBe(true)
  })
})
