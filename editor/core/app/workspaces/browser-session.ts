export interface RecentProject {
  id: string
  name: string
  templateId: string
  lastOpenedAt: number
  path?: string
}

export interface SavedBrowserProject extends RecentProject {
  handle?: FileSystemDirectoryHandle
}

export interface BrowserProjectSession {
  currentId?: string
  projects: SavedBrowserProject[]
}

export interface BrowserSessionStorage {
  load: () => Promise<BrowserProjectSession>
  save: (session: BrowserProjectSession) => Promise<void>
}

/** Handles need structured cloning; JSON/localStorage cannot preserve them. */
export function createBrowserSessionStorage(): BrowserSessionStorage {
  async function openDatabase() {
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('advjs-editor-workspaces', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('sessions')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Workspace storage is blocked'))
    })
  }

  async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
    const database = await openDatabase()
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = database.transaction('sessions', mode)
        const request = run(tx.objectStore('sessions'))
        tx.oncomplete = () => resolve(request.result)
        tx.onabort = () => reject(tx.error ?? request.error)
        tx.onerror = () => reject(tx.error ?? request.error)
      })
    }
    finally {
      database.close()
    }
  }

  return {
    async load() {
      const saved = await transaction<BrowserProjectSession | undefined>('readonly', store => store.get('browser'))
      if (saved)
        return saved

      // Keep existing recent-project entries usable; their directories need to
      // be selected once because previous versions only saved JSON metadata.
      try {
        const legacy: Array<Omit<RecentProject, 'id'>> = JSON.parse(localStorage.getItem('advjs:editor:recent-projects') ?? '[]')
        return { projects: legacy.slice(0, 10).map(project => ({ ...project, id: `legacy:${project.name}` })) }
      }
      catch {
        return { projects: [] }
      }
    },
    async save(session) {
      await transaction('readwrite', store => store.put(session, 'browser'))
    },
  }
}
