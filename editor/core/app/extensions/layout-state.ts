import type { EditorRegion } from '@advjs/editor-sdk'
import type { InjectionKey } from 'vue'
import type { RegisteredView } from './registry'
import { inject, reactive, watch } from 'vue'

export const UI_STATE_KEY = 'advjs:editor:ui:v1'
export const PLUGIN_STATE_KEY = 'advjs:editor:plugins:v1'
const regions: EditorRegion[] = ['navigation', 'main', 'bottom', 'inspector']
interface LayoutState { version: 1, active: Partial<Record<EditorRegion, string>> }

export function readStorage(storage: Pick<Storage, 'getItem'> | undefined, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null')
  }
  catch { return null }
}

export function saveStorage(storage: Pick<Storage, 'setItem'> | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  }
  catch { /* Private/restricted storage must not prevent editing. */ }
}

export function restoreLayout(value: unknown, legacy?: string | null): LayoutState {
  const result: LayoutState = { version: 1, active: {} }
  if (value && typeof value === 'object' && 'version' in value && value.version === 1 && 'active' in value && value.active && typeof value.active === 'object') {
    for (const region of regions) {
      const id = (value.active as Record<string, unknown>)[region]
      if (typeof id === 'string')
        result.active[region] = id
    }
  }
  else if (legacy && ['game', 'character', 'audio', 'flow-editor', 'dashboard'].includes(legacy)) {
    result.active.main = `advjs.core/${legacy}`
  }
  if (result.active.bottom === 'advjs.core/project') {
    result.active.navigation = 'advjs.core/project'
    result.active.bottom = 'advjs.core/assets'
  }
  return result
}

export function createEditorLayoutState(storage?: Storage) {
  let legacy: string | null = null
  try {
    legacy = storage?.getItem('cur-scene-tab') ?? null
  }
  catch { /* Optional storage. */ }
  const state = reactive(restoreLayout(readStorage(storage, UI_STATE_KEY), legacy))
  const stop = watch(state, value => saveStorage(storage, UI_STATE_KEY, value), { deep: true })
  return {
    state,
    select(region: EditorRegion, id: string) { state.active[region] = id },
    resolve(region: EditorRegion, views: readonly RegisteredView[]) {
      return views.find(view => view.key === state.active[region])?.key ?? views[0]?.key ?? ''
    },
    reset() { state.active = {} },
    dispose: stop,
  }
}

export const editorLayoutStateKey: InjectionKey<ReturnType<typeof createEditorLayoutState>> = Symbol('editor.view.layout')
export function useEditorLayoutState() {
  const layout = inject(editorLayoutStateKey)
  if (!layout)
    throw new Error('Editor layout state is unavailable')
  return layout
}
