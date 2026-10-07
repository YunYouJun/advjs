import type { BrowserProjectSession, SavedBrowserProject } from '../../editor/core/app/workspaces/browser-session'
import { describe, expect, it, vi } from 'vitest'
import { localEditorHistoryState, readLocalEditorSession } from '../../editor/core/app/adapters/local/session'
import { createBrowserProjectRecovery } from '../../editor/core/app/workspaces/recovery'

function directory(name = 'story', identity = name) {
  return {
    kind: 'directory',
    name,
    identity,
    queryPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    isSameEntry: vi.fn(async (other: { identity: string }) => identity === other.identity),
  } as unknown as FileSystemDirectoryHandle
}

function fixture(initial: BrowserProjectSession = { projects: [] }) {
  let saved = initial
  const storage = {
    load: vi.fn(async () => saved),
    save: vi.fn(async (session: BrowserProjectSession) => { saved = session }),
  }
  const open = vi.fn().mockResolvedValue(undefined)
  const pick = vi.fn().mockResolvedValue(directory('picked'))
  const warn = vi.fn()
  return { storage, open, pick, warn, recovery: createBrowserProjectRecovery({ storage, open, pick, warn }) }
}

function project(handle?: FileSystemDirectoryHandle): SavedBrowserProject {
  return { id: 'project-a', name: 'story', templateId: 'adv-md', lastOpenedAt: 1, handle }
}

describe('browser project recovery', () => {
  it('remembers the current directory and restores it after a new session starts', async () => {
    const handle = directory()
    const { recovery, storage, pick } = fixture()
    await recovery.remember(handle, 'adv-md')
    const saved = storage.save.mock.calls[0][0]
    expect(saved.currentId).toBe(saved.projects[0].id)
    expect(saved.projects[0].handle).toBe(handle)
    expect(recovery.recentProjects.value[0]).not.toHaveProperty('handle')

    const reload = fixture(saved)
    expect(await reload.recovery.restore()).toBe(true)
    expect(reload.open).toHaveBeenCalledWith(handle)
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    expect(handle.requestPermission).not.toHaveBeenCalled()
    expect(pick).not.toHaveBeenCalled()
    expect(reload.pick).not.toHaveBeenCalled()
    expect(reload.recovery.status.value).toBe('idle')
  })

  it('waits for a click when permission expires and requests it before other async work', async () => {
    const handle = directory()
    vi.mocked(handle.queryPermission).mockResolvedValue('prompt')
    const { recovery, open, pick } = fixture({ currentId: 'project-a', projects: [project(handle)] })
    expect(await recovery.restore()).toBe(false)
    expect(recovery.status.value).toBe('permission-required')
    expect(recovery.pending.value?.name).toBe('story')
    expect(open).not.toHaveBeenCalled()
    expect(handle.requestPermission).not.toHaveBeenCalled()

    const reconnecting = recovery.reopen('project-a')
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    expect(await reconnecting).toBe(true)
    expect(open).toHaveBeenCalledWith(handle)
    expect(pick).not.toHaveBeenCalled()
  })

  it('keeps denied permissions recoverable without opening the picker', async () => {
    const handle = directory()
    vi.mocked(handle.requestPermission).mockResolvedValue('denied')
    const { recovery, open, pick } = fixture({ projects: [project(handle)] })
    await recovery.load()
    expect(await recovery.reopen('project-a')).toBe(false)
    expect(recovery.status.value).toBe('permission-required')
    expect(open).not.toHaveBeenCalled()
    expect(pick).not.toHaveBeenCalled()
  })

  it('reports a deleted directory and can retry the original reference', async () => {
    const handle = directory()
    const { recovery, open } = fixture({ currentId: 'project-a', projects: [project(handle)] })
    open.mockRejectedValueOnce(new DOMException('Directory removed', 'NotFoundError'))
    expect(await recovery.restore()).toBe(false)
    expect(recovery.status.value).toBe('unavailable')
    expect(recovery.pending.value?.id).toBe('project-a')
    expect(await recovery.reopen('project-a')).toBe(true)
  })

  it('upgrades legacy recent projects through the folder picker and handles cancellation', async () => {
    const { recovery, pick, open } = fixture({ projects: [project()] })
    await recovery.load()
    pick.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
    expect(await recovery.reopen('project-a')).toBe(false)
    expect(recovery.status.value).toBe('idle')
    expect(open).not.toHaveBeenCalled()
    const handle = directory()
    pick.mockResolvedValue(handle)
    expect(await recovery.reopen('project-a')).toBe(true)
    expect(recovery.recentProjects.value).toHaveLength(1)
    expect(recovery.recentProjects.value[0]).toMatchObject({ name: 'story', templateId: 'adv-md' })
  })

  it('separates same-name directories and preserves identity when reopening', async () => {
    const { recovery } = fixture()
    const first = directory('story', '/a/story')
    const second = directory('story', '/b/story')
    await recovery.remember(first, 'adv-md')
    const firstId = recovery.recentProjects.value[0].id
    await recovery.remember(second)
    expect(recovery.recentProjects.value).toHaveLength(2)
    expect(recovery.recentProjects.value[0].id).not.toBe(firstId)
    await recovery.remember(first)
    expect(recovery.recentProjects.value).toHaveLength(2)
    expect(recovery.recentProjects.value[0]).toMatchObject({ id: firstId, templateId: 'adv-md' })
  })

  it('bounds stored handles and forgets the removed current project', async () => {
    const { recovery, storage } = fixture()
    for (let index = 0; index < 12; index++)
      await recovery.remember(directory(`story-${index}`))
    expect(recovery.recentProjects.value).toHaveLength(10)
    const current = recovery.recentProjects.value[0].id
    await recovery.remove(current)
    expect(storage.save.mock.calls.at(-1)?.[0].currentId).toBeUndefined()
    expect(recovery.recentProjects.value.some(item => item.id === current)).toBe(false)
  })

  it('allows editing when browser storage is unavailable', async () => {
    const { recovery, storage, warn, open } = fixture()
    storage.load.mockRejectedValue(new Error('Storage blocked'))
    storage.save.mockRejectedValue(new Error('Quota exceeded'))
    expect(await recovery.restore()).toBe(false)
    expect(recovery.status.value).toBe('idle')
    const handle = directory()
    await recovery.remember(handle)
    expect(await recovery.reopen(recovery.recentProjects.value[0].id)).toBe(true)
    expect(open).toHaveBeenCalledWith(handle)
    expect(warn).toHaveBeenCalled()
  })
})

describe('local workspace reload session', () => {
  const session = { origin: 'http://127.0.0.1:3456', token: 'local-token' }

  it('restores a scrubbed launch URL while preserving router history state', () => {
    const state = localEditorHistoryState({ position: 3, current: '/characters' }, session)
    expect(state).toMatchObject({ position: 3, current: '/characters' })
    expect(readLocalEditorSession(`${session.origin}/characters`, state)).toEqual(session)
    expect(localEditorHistoryState(state)).toEqual({ position: 3, current: '/characters' })
  })

  it('prefers a fresh launch and rejects credentials belonging to another origin', () => {
    const state = localEditorHistoryState({}, session)
    expect(readLocalEditorSession(`${session.origin}/#advjs-token=fresh`, state)?.token).toBe('fresh')
    expect(readLocalEditorSession('http://127.0.0.1:4567/', state)).toBeUndefined()
    expect(readLocalEditorSession('https://editor.advjs.org/', state)).toBeUndefined()
    expect(readLocalEditorSession(`${session.origin}/`, { advjsLocalWorkspace: { origin: 'https://evil.example', token: 'test' } })).toBeUndefined()
    expect(readLocalEditorSession(`${session.origin}/`, { advjsLocalWorkspace: { origin: session.origin, token: 1 } })).toBeUndefined()
  })
})
