/** Versioned, noncredential authoring state. Never serialize workspaces or handles. */
export interface DocumentRecovery {
  version: 1
  selected?: string
  source?: { path: string, base: string | null, content: string }
  forms: Record<string, { base: string | null, content: string }>
}

const limit = 2_000_000
export function recoveryPath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && path.length < 2048
    && !/[:\\]/u.test(path) && ![...path].some(char => char.charCodeAt(0) < 32) && !path.startsWith('/')
    && !path.split('/').some(part => !part || part === '.' || part === '..')
}
export function recoverableSource(path: string) {
  // Credentials/configuration files are deliberately excluded from draft storage.
  return recoveryPath(path) && /\.md$/iu.test(path)
}

export function readDocumentRecovery(id: string, storage: Pick<Storage, 'getItem'>): DocumentRecovery {
  const empty: DocumentRecovery = { version: 1, forms: {} }
  try {
    const raw = storage.getItem(`advjs:editor:documents:${id}`)
    if (!raw || raw.length > limit)
      return empty
    const value = JSON.parse(raw)
    if (value?.version !== 1)
      return empty
    if (recoveryPath(value.selected))
      empty.selected = value.selected
    const valid = (entry: unknown): entry is { base: string | null, content: string } => !!entry && typeof entry === 'object'
      && ('base' in entry && (entry.base === null || typeof entry.base === 'string')) && 'content' in entry && typeof entry.content === 'string'
    if (valid(value.source) && 'path' in value.source && typeof value.source.path === 'string' && recoverableSource(value.source.path))
      empty.source = { path: value.source.path, base: value.source.base, content: value.source.content }
    if (value.forms && typeof value.forms === 'object') {
      for (const [key, entry] of Object.entries(value.forms)) {
        if ((key === 'character:create' || key === 'music:import-brief' || /^character:edit:[\w-]+$/u.test(key)) && valid(entry))
          empty.forms[key] = { base: entry.base, content: entry.content }
      }
    }
    return empty
  }
  catch {
    return empty
  }
}

export function writeDocumentRecovery(id: string, value: DocumentRecovery, storage: Pick<Storage, 'setItem'>) {
  const serialized = JSON.stringify(value)
  if (serialized.length > limit)
    throw new Error('Editor recovery exceeds the storage limit; save the source file to preserve changes.')
  storage.setItem(`advjs:editor:documents:${id}`, serialized)
}
