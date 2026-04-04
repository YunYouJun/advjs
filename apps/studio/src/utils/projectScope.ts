import { DEFAULT_PROJECT_ID } from './db'

let _getProjectId: () => string = () => DEFAULT_PROJECT_ID

/**
 * Register the getter that resolves the current project ID.
 * Called once by useStudioStore during setup to avoid circular imports.
 */
export function setProjectIdGetter(fn: () => string) {
  _getProjectId = fn
}

/**
 * Get the current project ID.
 * Used by per-project stores so they don't need to import useStudioStore directly.
 */
export function getCurrentProjectId(): string {
  return _getProjectId()
}
