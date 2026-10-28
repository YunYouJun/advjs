import type { AdvCharacter } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { parseCharacterMd } from '@advjs/parser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useContentEditor } from '../composables/useContentEditor'
import { useContentSave } from '../composables/useContentSave'
import { setProjectIdGetter } from '../utils/projectScope'

const scopes: ReturnType<typeof effectScope>[] = []
const projectId = shallowRef('original')
beforeEach(() => {
  localStorage.clear()
  projectId.value = 'original'
  setProjectIdGetter(() => projectId.value)
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Blob', NodeBlob)
})
afterEach(() => {
  for (const scope of scopes.splice(0))
    scope.stop()
  vi.unstubAllGlobals()
})

function fixture() {
  const path = 'adv/characters/lin.character.md'
  const original = '---\nid: lin\nname: 林舟\nopaque: keep-me\n---\nUnmanaged exact body\n\n## 性格\n谨慎\n'
  const files: Record<string, string> = { [path]: original }
  // Availability/transaction bytes only; this unit input does not certify image decoding.
  const masterPath = 'adv/assets/characters/lin/avatar.png'
  const master = new Blob(['Original unit master'])
  const blobs = new Map([[masterPath, master]])
  const fs = {
    backend: 'browser',
    exists: async (path: string) => Object.hasOwn(files, path) || blobs.has(path),
    readFile: vi.fn(async (path: string) => files[path]!),
    collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) })),
    readBlob: async (path: string) => blobs.get(path)!,
    writeBlob: vi.fn(async (path: string, blob: Blob) => { blobs.set(path, blob) }),
    writeFile: vi.fn(async (path: string, content: string) => { files[path] = content }),
    deleteFile: vi.fn(async (path: string) => {
      delete files[path]
      blobs.delete(path)
    }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  const currentFs = shallowRef<IFileSystem | null>(fs)
  const scope = effectScope()
  scopes.push(scope)
  const editor = scope.run(() => useContentEditor<AdvCharacter>('character', () => ({ id: '', name: '' }), { getFs: () => currentFs.value }))!
  const service = useContentSave()
  const save = () => service.saveContent(currentFs.value!, 'character', editor.mode.value, editor.formData.value, editor.originalId.value, editor.saveContext())
  return { path, original, files, blobs, masterPath, master, fs, currentFs, editor, service, save }
}

describe('structured form source and draft boundaries', () => {
  it('refuses stale form fields while keeping the author draft and exact newer source', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.name = '旧草稿'
    const newer = f.original.replace('name: 林舟', 'name: 新作者').replace('谨慎', '新性格')
    f.files[f.path] = newer
    expect(await f.save()).toMatchObject({ success: false, conflict: true, error: 'ADV_STUDIO_SOURCE_CONFLICT' })
    expect(f.files[f.path]).toBe(newer)
    expect(f.editor.formData.value.name).toBe('旧草稿')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('edits the actual opened source and retains unknown metadata and unmanaged body', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.name = '作者修改'
    const result = await f.save()
    expect(result.success).toBe(true)
    expect(f.files[f.path]).toContain('opaque: keep-me')
    expect(f.files[f.path]).toContain('Unmanaged exact body')
    expect(parseCharacterMd(f.files[f.path]!).name).toBe('作者修改')
    expect(f.editor.onSaved(result)).toBe(true)
    expect(f.editor.isOpen.value).toBe(false)
  })

  it('keeps newer edits open when an earlier version finishes saving and permits their explicit save', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.name = 'First submitted version'
    let release!: () => void
    vi.mocked(f.fs.flush!).mockReturnValueOnce(new Promise<void>((resolve) => {
      release = resolve
    }))
    const pending = f.save()
    await vi.waitFor(() => expect(f.fs.flush).toHaveBeenCalled())
    f.editor.formData.value.name = 'Newer unsaved draft'
    release()
    const result = await pending
    expect(parseCharacterMd(f.files[f.path]!).name).toBe('First submitted version')
    expect(f.editor.onSaved(result)).toBe(false)
    expect(f.editor.isOpen.value).toBe(true)
    expect(f.editor.formData.value.name).toBe('Newer unsaved draft')
    const next = await f.save()
    expect(next.success).toBe(true)
    expect(f.editor.onSaved(next)).toBe(true)
    expect(parseCharacterMd(f.files[f.path]!).name).toBe('Newer unsaved draft')
    await nextTick()
    expect(localStorage.getItem('advjs-studio-draft-original-character')).toBeNull()
  })

  it('restores a draft with its old baseline rather than rebasing it onto a later author file', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.name = 'Persisted old draft'
    f.editor.close()
    f.files[f.path] = f.original.replace('name: 林舟', 'name: Later author')
    expect(f.editor.restoreDraft()).toBe(true)
    expect(await f.save()).toMatchObject({ success: false, conflict: true })
    expect(f.editor.formData.value.name).toBe('Persisted old draft')
    expect(f.files[f.path]).toContain('name: Later author')
  })

  it('retains a legacy edit draft without inventing an original source for it', async () => {
    const f = fixture()
    localStorage.setItem('advjs-studio-draft-original-character', JSON.stringify({ mode: 'edit', originalId: 'lin', data: { id: 'lin', name: 'Legacy draft' }, timestamp: Date.now() }))
    expect(f.editor.restoreDraft()).toBe(true)
    expect(await f.save()).toMatchObject({ success: false, error: 'ADV_STUDIO_EDIT_SOURCE_REQUIRED' })
    expect(f.editor.formData.value.name).toBe('Legacy draft')
    expect(f.files[f.path]).toBe(f.original)
  })

  it('keeps late old-project drafts in their original storage key and rejects writing into a new project', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    projectId.value = 'other'
    f.currentFs.value = { ...f.fs }
    f.editor.formData.value.name = 'Draft from original'
    await nextTick()
    expect(await f.save()).toMatchObject({ success: false, conflict: true })
    expect(localStorage.getItem('advjs-studio-draft-other-character')).toBeNull()
    expect(JSON.parse(localStorage.getItem('advjs-studio-draft-original-character')!).data.name).toBe('Draft from original')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('does not mutate the nested project model while editing a private form', () => {
    const f = fixture()
    const character: AdvCharacter = { id: 'lin', name: '林舟', voiceProfile: { intent: { pace: 'slow' } } }
    f.editor.openEdit(character, { fs: f.fs, path: f.path, content: f.original })
    f.editor.formData.value.voiceProfile!.intent!.pace = 'fast'
    expect(character.voiceProfile!.intent!.pace).toBe('slow')
    expect(f.files[f.path]).toBe(f.original)
  })

  it('treats unknown reads as errors without opening a fresh editable document', async () => {
    const f = fixture()
    vi.mocked(f.fs.readFile).mockRejectedValueOnce(new Error('Permission unknown'))
    await expect(f.editor.openFile(f.path)).rejects.toThrow('Permission unknown')
    expect(f.editor.isOpen.value).toBe(false)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('creates only absent targets and rejects a target created after the form opened', async () => {
    const f = fixture()
    f.editor.openCreate()
    f.editor.formData.value = { id: 'new', name: 'New author' }
    f.files['adv/characters/new.character.md'] = 'An independently created source'
    expect(await f.save()).toMatchObject({ success: false, conflict: true })
    expect(f.files['adv/characters/new.character.md']).toBe('An independently created source')
  })
})

describe('structured form immutable media staging', () => {
  const image = 'data:image/png;base64,VW5pdCBpbWFnZSBieXRlcyBvbmx5'
  it('keeps SVG uploads supported without putting the MIME suffix into an unsafe path', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.avatar = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')}`
    expect(await f.save()).toMatchObject({ success: true })
    const avatar = parseCharacterMd(f.files[f.path]!).avatar!
    expect(avatar).toMatch(/\.[a-f0-9]{64}\.svg$/)
    expect(f.blobs.get(`adv/${avatar}`)?.type).toBe('image/svg+xml')
  })
  it('does not write extracted image bytes if character serialization fails', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    Object.assign(f.editor.formData.value, { avatar: image, voiceProfile: { apiKey: 'invalid-private-field' } })
    expect(await f.save()).toMatchObject({ success: false })
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(f.files[f.path]).toBe(f.original)
    expect(f.blobs.get(f.masterPath)).toBe(f.master)
  })

  it('compensates a source write that persists then throws, without replacing an old master', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.avatar = image
    vi.mocked(f.fs.writeFile).mockImplementation(async (path, value) => {
      f.files[path] = value
      if (value !== f.original)
        throw new Error('Source write persisted then failed')
    })
    expect(await f.save()).toMatchObject({ success: false, error: 'Source write persisted then failed' })
    expect(f.files[f.path]).toBe(f.original)
    expect([...f.blobs.keys()]).toEqual([f.masterPath])
    expect(f.blobs.get(f.masterPath)).toBe(f.master)
  })

  it('preserves copied media when a new independent author source may reference it', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.avatar = image
    vi.mocked(f.fs.writeFile).mockImplementation(async (path, value) => {
      f.files[path] = value
      if (value !== f.original) {
        f.files['adv/world.md'] = 'New independent author media reference'
        throw new Error('Source write failed after external save')
      }
    })
    expect(await f.save()).toMatchObject({ success: false, error: 'ADV_STUDIO_ROLLBACK_INCOMPLETE' })
    expect(f.files[f.path]).toBe(f.original)
    expect(f.files['adv/world.md']).toBe('New independent author media reference')
    expect(f.blobs.size).toBe(2)
  })

  it('writes an immutable hash path and reuses only verified matching bytes on a later save', async () => {
    const f = fixture()
    await f.editor.openFile(f.path)
    f.editor.formData.value.avatar = image
    const result = await f.save()
    expect(result.success).toBe(true)
    const avatar = parseCharacterMd(f.files[f.path]!).avatar!
    expect(avatar).toMatch(/^assets\/characters\/lin\/avatar\.[a-f0-9]{64}\.png$/)
    expect(f.blobs.get(`adv/${avatar}`)).toBeDefined()
    expect(f.blobs.get(f.masterPath)).toBe(f.master)
    expect(f.editor.onSaved(result)).toBe(true)
    // Explicitly reopen and supply the same input bytes, never overwrite the original master.
    await f.editor.openFile(f.path)
    f.editor.formData.value.avatar = image
    expect(await f.save()).toMatchObject({ success: true })
    expect(f.fs.writeBlob).toHaveBeenCalledOnce()
  })
})
