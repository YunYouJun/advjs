import { readonly, shallowRef } from 'vue'

export type EditorStartupPhase = 'preferences' | 'extensions' | 'workspace'

export interface EditorStartupTask {
  id: EditorStartupPhase
  run: () => Promise<unknown>
}

export interface EditorStartupState {
  status: 'loading' | 'error' | 'ready'
  phase: EditorStartupPhase | 'ready'
  completed: number
  total: number
  progress: number
  error: string
  errorDetails?: unknown
}

/** Startup progress counts completed tasks, never elapsed time or estimated bytes. */
export function createEditorStartup(tasks: readonly EditorStartupTask[]) {
  const state = shallowRef<EditorStartupState>({
    status: tasks.length ? 'loading' : 'ready',
    phase: tasks[0]?.id ?? 'ready',
    completed: 0,
    total: tasks.length,
    progress: tasks.length ? 0 : 100,
    error: '',
  })
  let running: Promise<void> | undefined
  let disposed = false

  async function run() {
    for (let index = state.value.completed; index < tasks.length; index++) {
      state.value = { ...state.value, status: 'loading', phase: tasks[index]!.id, error: '', errorDetails: undefined }
      try {
        await tasks[index]!.run()
      }
      catch (error) {
        if (!disposed) {
          state.value = { ...state.value, status: 'error', error: error instanceof Error ? error.message : String(error), errorDetails: error }
        }
        return
      }
      if (disposed)
        return
      const completed = index + 1
      state.value = { ...state.value, completed, progress: Math.round(completed / tasks.length * 100) }
    }
    state.value = { ...state.value, status: 'ready', phase: 'ready' }
  }

  return {
    state: readonly(state),
    start() {
      if (disposed || state.value.status === 'ready')
        return Promise.resolve()
      // A retry resumes the failed task; successful initialization is not repeated.
      running ??= run().finally(() => {
        running = undefined
      })
      return running
    },
    dispose() {
      disposed = true
    },
  }
}
