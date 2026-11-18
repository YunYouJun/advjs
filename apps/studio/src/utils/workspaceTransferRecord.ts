import type { IFileSystem } from './fs'
import type { WorkspaceFileEntry } from './workspaceFileSnapshot'
import type { WorkspaceMutationRecord } from './workspaceMutationJournal'
import { assertWorkspacePath, snapshotWorkspaceFiles, validateWorkspaceEntries, workspaceContains } from './workspaceFileSnapshot'

/** Transfer destinations refer to the one durable source copy, including empty directories. */
export function workspaceMutationAfter(record: WorkspaceMutationRecord): WorkspaceFileEntry[] {
  if (record.kind !== 'transfer')
    return record.after
  if (!record.transfers)
    throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  return record.transfers.flatMap(intent => record.before.filter(entry => workspaceContains(intent.source, entry.path))
    .flatMap(entry => [
      ...(!intent.move ? [entry] : []),
      { ...entry, path: intent.target + entry.path.slice(intent.source.length) },
    ]))
}

/** Keep the previous 100-transfer/1,024-source-entry/64-MiB limits without storing copies twice. */
export async function validateWorkspaceTransferRecord(record: WorkspaceMutationRecord) {
  const transfers = record.transfers
  if (!Array.isArray(transfers) || !transfers.length || transfers.length > 100 || record.after.length
    || transfers.some(intent => !intent || Object.keys(intent).sort().join(':') !== 'move:source:target'
      || typeof intent.source !== 'string' || typeof intent.target !== 'string' || typeof intent.move !== 'boolean')) {
    throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  }
  const roots = transfers.flatMap(intent => [intent.source, intent.target])
  roots.forEach(assertWorkspacePath)
  if (JSON.stringify(roots) !== JSON.stringify(record.roots)
    || roots.some((path, i) => roots.some((other, j) => i !== j && workspaceContains(other, path)))
    || transfers.some(intent => !record.before.some(entry => entry.path === intent.source))) {
    throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  }
  const entries = new Map(record.before.map(entry => [entry.path, entry]))
  if (record.before.some(entry => !transfers.some(intent => intent.source === entry.path)
    && entries.get(entry.path.slice(0, entry.path.lastIndexOf('/')))?.kind !== 'directory')) {
    throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  }
  return validateWorkspaceEntries(transfers.map(intent => intent.source), record.before, record.drafts)
}

/** A copy can have twice as many live entries as the single stored source snapshot. */
export async function snapshotWorkspaceMutation(fs: IFileSystem, record: WorkspaceMutationRecord, check: () => void = () => {}) {
  if (record.kind !== 'transfer')
    return snapshotWorkspaceFiles(fs, record.roots, check)
  await validateWorkspaceTransferRecord(record)
  const entries: WorkspaceFileEntry[] = []
  let bytes = 0
  for (const root of record.roots) {
    const captured = await snapshotWorkspaceFiles(fs, [root], check)
    bytes += captured.reduce((sum, entry) => sum + (entry.data?.byteLength ?? 0), 0)
    if (entries.length + captured.length > 2048 || bytes > 128 * 1024 * 1024)
      throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
    entries.push(...captured)
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}
