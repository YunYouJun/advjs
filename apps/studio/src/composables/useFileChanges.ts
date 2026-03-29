import { reactive, ref } from 'vue'

export interface FileChange {
  path: string
  originalContent: string
  modifiedContent: string
  timestamp: number
}

const changes = reactive(new Map<string, FileChange>())
const version = ref(0)

export function useFileChanges() {
  function recordChange(path: string, originalContent: string, modifiedContent: string) {
    changes.set(path, {
      path,
      originalContent,
      modifiedContent,
      timestamp: Date.now(),
    })
    version.value++
  }

  function getChange(path: string): FileChange | undefined {
    return changes.get(path)
  }

  function hasChange(path: string): boolean {
    return changes.has(path)
  }

  function clearChanges() {
    changes.clear()
    version.value++
  }

  function clearChange(path: string) {
    changes.delete(path)
    version.value++
  }

  function getAllChanges(): FileChange[] {
    return Array.from(changes.values())
  }

  return {
    changes,
    version,
    recordChange,
    getChange,
    hasChange,
    clearChanges,
    clearChange,
    getAllChanges,
  }
}
