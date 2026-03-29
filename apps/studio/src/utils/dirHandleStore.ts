/**
 * Persist FileSystemDirectoryHandle to IndexedDB.
 *
 * localStorage cannot store FileSystemDirectoryHandle (not serializable to JSON),
 * but IndexedDB structured clone algorithm supports it natively.
 *
 * Reference: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
 * Chrome 122+ supports persistent permissions ("Allow on every visit"),
 * so restored handles often work without re-prompting.
 */

const DB_NAME = 'advjs-studio'
const DB_VERSION = 1
const STORE_NAME = 'dir-handles'

let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance)
    return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Save a directory handle for a project by name */
export async function saveDirHandle(projectName: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, projectName)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Load a directory handle for a project by name */
export async function loadDirHandle(projectName: string): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(projectName)
    request.onsuccess = () => resolve(request.result as FileSystemDirectoryHandle | undefined)
    request.onerror = () => reject(request.error)
  })
}

/** Remove a directory handle entry */
export async function removeDirHandle(projectName: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(projectName)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Verify permission on a persisted handle (non-interactive).
 *
 * Chrome 122+ with "Allow on every visit": queryPermission returns 'granted' directly.
 * Older Chrome / first visit: returns 'prompt', meaning requestPermission is needed.
 */
export async function verifyDirHandle(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const permission = await (handle as any).queryPermission({ mode: 'readwrite' })
    return permission === 'granted'
  }
  catch {
    return false
  }
}

/**
 * Request permission for a persisted handle (interactive — needs user gesture).
 *
 * Chrome 122+: shows "Allow on every visit" / "Allow this time" / "Don't allow".
 * Older Chrome: shows a simple allow/block prompt.
 */
export async function requestDirHandlePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const permission = await (handle as any).requestPermission({ mode: 'readwrite' })
    return permission === 'granted'
  }
  catch {
    return false
  }
}

/**
 * One-shot: restore handle + verify/request permission.
 *
 * Flow (Chrome official best practice):
 *   1. loadDirHandle from IDB
 *   2. queryPermission — if 'granted', done (silent, no prompt)
 *   3. requestPermission — browser shows permission prompt (needs user gesture)
 *   4. If all fail, return null (caller should show "re-select directory" UI)
 */
export async function restoreAndVerifyHandle(projectName: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await loadDirHandle(projectName)
    if (!handle)
      return null

    // Step 1: check silently (works if user chose "Allow on every visit")
    if (await verifyDirHandle(handle))
      return handle

    // Step 2: request interactively (shows browser permission prompt)
    if (await requestDirHandlePermission(handle))
      return handle

    return null
  }
  catch {
    return null
  }
}
