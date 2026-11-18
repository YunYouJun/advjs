import { describe, expect, it, vi } from 'vitest'
import { BrowserFsAdapter } from '../utils/fs/BrowserFsAdapter'
import { CapacitorFsAdapter } from '../utils/fs/CapacitorFsAdapter'

const { stat } = vi.hoisted(() => ({ stat: vi.fn() }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { stat }, Directory: { Documents: 'DOCUMENTS' }, Encoding: { UTF8: 'utf8' } }))

describe('filesystem absence and unknown read failures', () => {
  it('treats only a browser NotFoundError as absence', async () => {
    const getDirectoryHandle = vi.fn()
    const getFileHandle = vi.fn().mockRejectedValue(new DOMException('absent', 'NotFoundError'))
    const fs = new BrowserFsAdapter({ getFileHandle, getDirectoryHandle } as unknown as FileSystemDirectoryHandle)
    await expect(fs.exists('missing.md')).resolves.toBe(false)
    expect(getDirectoryHandle).not.toHaveBeenCalled()
    const error = new DOMException('permission unknown', 'NotAllowedError')
    getFileHandle.mockRejectedValue(error)
    await expect(fs.exists('private.md')).rejects.toBe(error)
    expect(getDirectoryHandle).not.toHaveBeenCalled()
  })

  it('recognizes actual directories through TypeMismatchError without hiding other failures', async () => {
    const getDirectoryHandle = vi.fn().mockResolvedValue({ name: 'chapter' })
    const getFileHandle = vi.fn().mockRejectedValue(new DOMException('directory', 'TypeMismatchError'))
    const fs = new BrowserFsAdapter({ getFileHandle, getDirectoryHandle } as unknown as FileSystemDirectoryHandle)
    await expect(fs.exists('chapter')).resolves.toBe(true)
    expect(getDirectoryHandle).toHaveBeenCalledOnce()
    const error = new DOMException('directory permission unknown', 'NotAllowedError')
    getDirectoryHandle.mockRejectedValue(error)
    await expect(fs.exists('chapter')).rejects.toBe(error)
  })

  it('recognizes the installed native Capacitor missing-file code', async () => {
    stat.mockRejectedValue({ code: 'OS-PLUG-FILE-0008', message: 'Missing file' })
    await expect(new CapacitorFsAdapter('advjs/unit').exists('missing.md')).resolves.toBe(false)
  })

  it.each(['OS-PLUG-FILE-0004', 'OS-PLUG-FILE-0007', 'OS-PLUG-FILE-0013'])('does not treat Capacitor %s as an absent file', async (code) => {
    const error = { code, message: 'Unknown read outcome' }
    stat.mockRejectedValue(error)
    await expect(new CapacitorFsAdapter('advjs/unit').exists('source.md')).rejects.toBe(error)
  })
})
