/**
 * Monaco support for `.adv.md` files.
 *
 * Highlighting comes from the shared TextMate grammar (see
 * `packages/shared/adv-monaco.ts`), so Studio, the Editor and the docs site
 * color scripts the same way. Studio adds completions for project names.
 */

import type * as Monaco from 'monaco-editor'
import { ADV_LANGUAGE_ID, registerAdvMonacoLanguage } from '../../../../packages/shared/adv-monaco'

export { ADV_LANGUAGE_ID, advMonacoTheme } from '../../../../packages/shared/adv-monaco'

const RE_AT_PREFIX = /@\S*$/

export interface AdvCompletionContext {
  characterNames: string[]
  sceneNames: string[]
  locationNames: string[]
}

/**
 * Create a completion provider for ADV.JS files.
 * Provides auto-complete for character names, scene names, and location names.
 */
export function createAdvCompletionProvider(
  getContext: () => AdvCompletionContext,
): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['@', '【', ',', '，'],

    provideCompletionItems(model, position) {
      const lineContent = model.getLineContent(position.lineNumber)
      const textBefore = lineContent.substring(0, position.column - 1)
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const ctx = getContext()
      const suggestions: Monaco.languages.CompletionItem[] = []

      // Character name completion after @
      if (textBefore.endsWith('@') || RE_AT_PREFIX.test(textBefore)) {
        const atRange = {
          ...range,
          startColumn: textBefore.lastIndexOf('@') + 1,
        }
        for (const name of ctx.characterNames) {
          suggestions.push({
            label: `@${name}`,
            kind: 1, // CompletionItemKind.Text
            detail: 'Character',
            insertText: `@${name}`,
            range: atRange,
          })
        }
        return { suggestions }
      }

      // Scene/Location names inside 【...】
      if (textBefore.includes('【') && !textBefore.includes('】')) {
        // Offer scene names
        for (const name of ctx.sceneNames) {
          suggestions.push({
            label: name,
            kind: 5, // CompletionItemKind.Field
            detail: 'Scene',
            insertText: name,
            range,
          })
        }
        // Offer location names
        for (const name of ctx.locationNames) {
          suggestions.push({
            label: name,
            kind: 5,
            detail: 'Location',
            insertText: name,
            range,
          })
        }
        return { suggestions }
      }

      // Generic: offer all completions when triggered
      for (const name of ctx.characterNames) {
        suggestions.push({
          label: name,
          kind: 1,
          detail: 'Character',
          insertText: name,
          range,
        })
      }

      return { suggestions }
    },
  }
}

const registered = new WeakSet<object>()

/**
 * Register the ADV language, its `adv-light` / `adv-dark` themes and the
 * completion provider with a Monaco instance. Later calls for the same
 * instance return false and keep the first context getter.
 */
export function registerAdvLanguage(
  monaco: typeof Monaco,
  getContext: () => AdvCompletionContext,
): boolean {
  registerAdvMonacoLanguage(monaco)
  if (registered.has(monaco.languages))
    return false
  registered.add(monaco.languages)
  monaco.languages.registerCompletionItemProvider(
    ADV_LANGUAGE_ID,
    createAdvCompletionProvider(getContext),
  )
  return true
}
