import type { IFileSystem } from './fs'

export interface WorkspaceFileEntry { path: string, kind: 'file' | 'directory', data?: ArrayBuffer, sha256?: string }
export interface WorkspacePrivateDraft { path: string, source: string | null, content: string }
export const workspaceContains = (parent: string, path: string) => parent === path || path.startsWith(`${parent}/`)
export function assertWorkspacePath(path: string) {
  if (!path || /^(?:[a-z]+:|\/)/i.test(path) || path.includes('\\') || Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    || path.split('/').some(part => ['', '.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))) {
    throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
  }
}
export async function workspaceBytesHash(data: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), byte => byte.toString(16).padStart(2, '0')).join('')
}
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  try {
    // Native Blob and worker results can belong to another JavaScript realm.
    ArrayBuffer.prototype.slice.call(value, 0, 0)
    return true
  }
  catch { return false }
}
export function workspaceEntryEqual(a: WorkspaceFileEntry | undefined, b: WorkspaceFileEntry | undefined) {
  return a?.kind === b?.kind && a?.sha256 === b?.sha256
}
export async function readWorkspaceEntry(fs: IFileSystem, path: string): Promise<WorkspaceFileEntry | undefined> {
  assertWorkspacePath(path)
  if (!await fs.exists(path))
    return undefined
  const stat = await fs.stat(path)
  if (stat.type === 'directory')
    return { path, kind: 'directory' }
  if (stat.size > 64 * 1024 * 1024)
    throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
  const data = await (await fs.readBlob(path)).arrayBuffer()
  if (data.byteLength > 64 * 1024 * 1024)
    throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
  return { path, kind: 'file', data, sha256: await workspaceBytesHash(data) }
}
export async function snapshotWorkspaceFiles(fs: IFileSystem, roots: readonly string[], check: () => void = () => {}) {
  if (!roots.length || roots.length > 100)
    throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
  const entries: WorkspaceFileEntry[] = []
  let bytes = 0
  async function visit(path: string) {
    check()
    const entry = await readWorkspaceEntry(fs, path)
    check()
    if (!entry)
      return
    bytes += entry.data?.byteLength ?? 0
    if (entries.length >= 1024 || bytes > 64 * 1024 * 1024)
      throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
    entries.push(entry)
    if (entry.kind === 'directory') {
      for (const child of await fs.readdir(path)) {
        if (child.path !== `${path}/${child.name}` || child.name.includes('/'))
          throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
        await visit(child.path)
      }
    }
  }
  for (const root of roots) {
    assertWorkspacePath(root)
    if (roots.some(other => other !== root && workspaceContains(other, root)))
      throw new Error('ADV_STUDIO_TRANSFER_OVERLAP')
    await visit(root)
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}
export function workspaceSnapshotsEqual(a: readonly WorkspaceFileEntry[], b: readonly WorkspaceFileEntry[]) {
  const other = new Map(b.map(entry => [entry.path, entry]))
  return a.length === b.length && a.every(entry => workspaceEntryEqual(entry, other.get(entry.path)))
}
export async function validateWorkspaceEntries(roots: readonly string[], entries: readonly WorkspaceFileEntry[], drafts: readonly WorkspacePrivateDraft[] = []) {
  if (!roots.length || roots.length > 100 || new Set(roots).size !== roots.length || entries.length > 1024 || new Set(entries.map(entry => entry.path)).size !== entries.length || drafts.length > 1024 || new Set(drafts.map(draft => draft.path)).size !== drafts.length)
    throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  roots.forEach(assertWorkspacePath)
  let bytes = 0
  for (const entry of entries) {
    assertWorkspacePath(entry.path)
    if (!roots.some(root => workspaceContains(root, entry.path)))
      throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    if (entry.kind === 'file') {
      if (!isArrayBuffer(entry.data) || entry.data.byteLength > 64 * 1024 * 1024)
        throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
      bytes += entry.data.byteLength
      if (bytes > 64 * 1024 * 1024 || await workspaceBytesHash(entry.data) !== entry.sha256)
        throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    }
    else if (entry.kind !== 'directory' || entry.data || entry.sha256) {
      throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    }
  }
  for (const draft of drafts) {
    assertWorkspacePath(draft.path)
    if (!roots.some(root => workspaceContains(root, draft.path)) || typeof draft.content !== 'string' || (draft.source !== null && typeof draft.source !== 'string'))
      throw new Error('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    bytes += new TextEncoder().encode(draft.content).byteLength + new TextEncoder().encode(draft.source ?? '').byteLength
  }
  if (bytes > 64 * 1024 * 1024)
    throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
  return bytes
}
