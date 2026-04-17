/**
 * Monaco Editor on-demand setup.
 *
 * Configures Monaco to only load workers for the 4 languages
 * actually used in Studio: markdown, yaml, json, typescript.
 * This avoids bundling 70+ unused language workers (~7MB savings).
 */

import type * as Monaco from 'monaco-editor'
import type { AdvCompletionContext } from './advLanguage'

let _monaco: typeof Monaco | null = null
let _advRegistered = false

/**
 * Lazily load and configure Monaco editor.
 * Returns the module only after environment (workers) is set up.
 */
export async function getMonaco(): Promise<typeof Monaco> {
  if (_monaco) {
    return _monaco
  }

  // Configure worker URLs before first import
  // Monaco looks at `MonacoEnvironment` to decide how to spawn workers
  ;(globalThis as any).MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      // JSON language service
      if (label === 'json') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
          { type: 'module' },
        )
      }
      // TypeScript / JavaScript language service
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
          { type: 'module' },
        )
      }
      // CSS / SCSS / LESS
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
          { type: 'module' },
        )
      }
      // HTML (also handles handlebars / razor)
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
          { type: 'module' },
        )
      }
      // Default editor worker (tokenization, text operations)
      return new Worker(
        new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
        { type: 'module' },
      )
    },
  }

  const m = await import('monaco-editor')
  _monaco = m
  return m
}

/**
 * Register the ADV.JS language with Monaco if not already done.
 * Call this after getMonaco() and provide a context getter for completions.
 */
export async function registerAdvLanguageIfNeeded(
  getContext: () => AdvCompletionContext,
): Promise<void> {
  if (_advRegistered)
    return
  const monaco = await getMonaco()
  const { registerAdvLanguage } = await import('./advLanguage')
  registerAdvLanguage(monaco, getContext)
  _advRegistered = true
}
