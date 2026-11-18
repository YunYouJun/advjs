import type { EditorProjectHostInfo, EditorRepository, EditorRepositoryBinding } from './host-protocol.ts'
import { isAbsolute } from 'node:path'

export type { EditorProjectHostInfo, EditorRepository, EditorRepositoryBinding } from './host-protocol.ts'

type WorkbenchRepository = EditorRepository
type WorkbenchInfo = EditorProjectHostInfo
type WorkbenchBinding = EditorRepositoryBinding
/** Trusted main-process configuration. Never supplied by an Editor plugin or project file. */
export function createEditorProjectHostClient(input?: string, token?: string) {
  if (!input)
    return undefined
  const url = new URL(input)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/__advjs/workspaces' || url.username || url.password || url.search || url.hash || !token || !/^[a-f0-9]{64}$/u.test(token))
    throw new Error('Workbench host requires a fixed loopback control URL and token')
  async function request(operation: string, payload: Record<string, unknown> = {}) {
    const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Advjs-Workspace-Token': token! }, body: JSON.stringify({ operation, ...payload }), signal: AbortSignal.timeout(15000), redirect: 'error' })
    const data = await result.json() as Record<string, unknown>
    if (!result.ok)
      throw new Error(typeof data.message === 'string' ? data.message : 'Workbench repository operation failed')
    return data
  }
  function repository(value: Record<string, unknown>): WorkbenchRepository {
    if (typeof value.root !== 'string' || !isAbsolute(value.root) || typeof value.name !== 'string' || !value.name)
      throw new Error('Invalid workbench repository response')
    return { root: value.root, name: value.name }
  }
  return {
    async info(): Promise<WorkbenchInfo> {
      const data = await request('info')
      if (data.apiVersion !== undefined && data.apiVersion !== 1)
        throw new Error('Unsupported project host protocol version')
      if (typeof data.id !== 'string' || !/^[a-z][a-z0-9.-]*$/u.test(data.id) || typeof data.title !== 'string' || typeof data.defaultRoot !== 'string' || !isAbsolute(data.defaultRoot))
        throw new Error('Invalid workbench provider response')
      return { ...(data.apiVersion === undefined ? {} : { apiVersion: 1 as const }), id: data.id, title: data.title, defaultRoot: data.defaultRoot }
    },
    async inspect(path: string) { return repository(await request('inspect', { path })) },
    async open(path: string): Promise<WorkbenchBinding> {
      const data = await request('open', { path })
      if (data.apiVersion !== undefined && data.apiVersion !== 1)
        throw new Error('Unsupported project host protocol version')
      if (typeof data.id !== 'string' || !data.id || typeof data.apiToken !== 'string' || !/^[a-f0-9]{64}$/u.test(data.apiToken))
        throw new Error('Invalid workbench session response')
      return { ...repository(data), id: data.id, apiToken: data.apiToken }
    },
    async release(id: string) { await request('release', { id }) },
  }
}
export type EditorProjectHostClient = NonNullable<ReturnType<typeof createEditorProjectHostClient>>
