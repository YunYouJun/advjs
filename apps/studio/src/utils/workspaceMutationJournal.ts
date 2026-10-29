import type { IFileSystem } from './fs'
import type { WorkspaceFileEntry, WorkspacePrivateDraft } from './workspaceFileSnapshot'
import Dexie from 'dexie'
import { setStudioProjectWriteBarrier, studioProjectBarrierRevision } from './projectWriteQueue'
import { validateWorkspaceEntries } from './workspaceFileSnapshot'

export interface WorkspaceMutationRecord {
  id: string
  projectId: string
  root: FileSystemDirectoryHandle
  kind: 'create' | 'delete' | 'import'
  createdAt: number
  roots: string[]
  before: WorkspaceFileEntry[]
  after: WorkspaceFileEntry[]
  drafts: WorkspacePrivateDraft[]
  bytes: number
}
const database = new Dexie('advjs-studio-workspace-mutations')
database.version(1).stores({ entries: 'id, projectId' })
const entries = database.table<WorkspaceMutationRecord, string>('entries')

export async function listWorkspaceMutationRecords(_projectId: string, root: FileSystemDirectoryHandle) {
  const result: WorkspaceMutationRecord[] = []
  for (const entry of await entries.toArray()) {
    if (await entry.root.isSameEntry(root))
      result.push(entry)
  }
  return result.sort((a, b) => a.createdAt - b.createdAt)
}
export async function refreshWorkspaceMutationBarrier(fs: IFileSystem, projectId: string, root: FileSystemDirectoryHandle) {
  try {
    let revision: number
    let records: WorkspaceMutationRecord[]
    do {
      revision = studioProjectBarrierRevision(fs)
      records = await listWorkspaceMutationRecords(projectId, root)
    } while (revision !== studioProjectBarrierRevision(fs))
    setStudioProjectWriteBarrier(fs, records.length ? 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED' : undefined)
    return records
  }
  catch (error) {
    setStudioProjectWriteBarrier(fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_UNKNOWN')
    throw error
  }
}
export async function validateWorkspaceMutationRecord(record: WorkspaceMutationRecord) {
  const before = await validateWorkspaceEntries(record.roots, record.before, record.drafts)
  const after = await validateWorkspaceEntries(record.roots, record.after)
  if (before + after > 64 * 1024 * 1024 || record.bytes !== before + after || !['create', 'delete', 'import'].includes(record.kind))
    throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  if (record.kind === 'delete' ? record.after.length || !record.before.length : record.before.length || !record.after.length)
    throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
}
export async function persistWorkspaceMutationRecord(record: WorkspaceMutationRecord) {
  await validateWorkspaceMutationRecord(record)
  const observed = await entries.toArray()
  for (const entry of observed) {
    if (await entry.root.isSameEntry(record.root))
      throw new Error('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
  }
  // Keep all unresolved records; storage pressure must not silently evict originals.
  await database.transaction('rw', entries, async () => {
    const all = await entries.toArray()
    if (JSON.stringify(all.map(entry => entry.id).sort()) !== JSON.stringify(observed.map(entry => entry.id).sort()))
      throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    if (all.length >= 32 || all.reduce((bytes, entry) => bytes + entry.bytes, record.bytes) > 64 * 1024 * 1024)
      throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
    await entries.add(record)
  })
}
export async function removeWorkspaceMutationRecord(id: string) {
  await entries.delete(id)
}
export async function assertWorkspaceMutationRecorded(record: WorkspaceMutationRecord) {
  const actual = await entries.get(record.id)
  if (!actual || actual.projectId !== record.projectId || actual.createdAt !== record.createdAt || !await actual.root.isSameEntry(record.root))
    throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
}
