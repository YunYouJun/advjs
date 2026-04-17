/**
 * Custom Monaco language definition for .adv.md files.
 *
 * Provides:
 * - Monarch tokenizer for ADV.JS-specific syntax highlighting
 * - Completion provider for character names, scene names, and location names
 */

import type * as Monaco from 'monaco-editor'

export const ADV_LANGUAGE_ID = 'adv-markdown'

// Monarch tokenizer regex patterns (module-scope to avoid re-compilation)
const RE_FRONTMATTER_DELIM = /^---$/
const RE_SCENE_MARKER = /【[^】]*】/
const RE_CHARACTER_REF = /^@\S+/
const RE_NARRATION = /（[^）]*）/
const RE_DIALOGUE = /「[^」]*」/
const RE_CHOICE_START = /^-\s+\[/
const RE_HEADING = /^#{1,6}\s.*$/
const RE_BOLD = /\*\*[^*]+\*\*/
const RE_ITALIC = /\*[^*]+\*/
const RE_BLOCKQUOTE = /^>\s+(?:\S.*)?$/
const RE_CODE_FENCE = /^```/
const RE_COMMENT_OPEN = /<!/
const RE_FRONTMATTER_KEY = /^[\w-]+:/
const RE_CHOICE_END = /\]/
const RE_COMMENT_CLOSE = /-->/
const RE_ANY = /./

/**
 * Monarch tokenizer rules for ADV.JS script syntax.
 * Extends Markdown with ADV-specific tokens.
 */
export function getAdvTokensProvider(): Monaco.languages.IMonarchLanguage {
  return {
    defaultToken: '',
    tokenPostfix: '.adv',

    // Character references: @Name
    // Scene markers: 【place，time，inOrOut】
    // Narration: （text） or (text)
    // Dialogue: 「text」
    // Choices: - [text](#anchor)

    tokenizer: {
      root: [
        // Frontmatter (YAML block)
        [RE_FRONTMATTER_DELIM, { token: 'meta.content', next: '@frontmatter' }],

        // Scene markers: 【...】
        [RE_SCENE_MARKER, 'keyword.scene'],

        // Character reference: @CharacterName (at start of line)
        [RE_CHARACTER_REF, 'entity.name.character'],

        // Narration: （...） Chinese parens
        [RE_NARRATION, 'comment.narration'],

        // Dialogue brackets: 「...」
        [RE_DIALOGUE, 'string.dialogue'],

        // Choices: - [...](#...)
        [RE_CHOICE_START, { token: 'keyword.choice', next: '@choice' }],

        // Markdown headings
        [RE_HEADING, 'keyword.heading'],

        // Markdown bold
        [RE_BOLD, 'strong'],

        // Markdown italic
        [RE_ITALIC, 'emphasis'],

        // Markdown blockquote (narration in ADV)
        [RE_BLOCKQUOTE, 'comment.blockquote'],

        // Code blocks
        [RE_CODE_FENCE, { token: 'string.code', next: '@codeblock' }],

        // Comments
        [RE_COMMENT_OPEN, { token: 'comment', next: '@comment' }],

        // Default text
        [RE_ANY, 'text'],
      ],

      frontmatter: [
        [RE_FRONTMATTER_DELIM, { token: 'meta.content', next: '@pop' }],
        [RE_FRONTMATTER_KEY, 'attribute.name'],
        [RE_ANY, 'attribute.value'],
      ],

      choice: [
        [RE_CHOICE_END, { token: 'keyword.choice', next: '@pop' }],
        [RE_ANY, 'string.choice-text'],
      ],

      codeblock: [
        [RE_CODE_FENCE, { token: 'string.code', next: '@pop' }],
        [RE_ANY, 'string.code'],
      ],

      comment: [
        [RE_COMMENT_CLOSE, { token: 'comment', next: '@pop' }],
        [RE_ANY, 'comment'],
      ],
    },
  }
}

/**
 * Theme rules for the ADV language tokens.
 */
export function getAdvThemeRules(): Monaco.editor.ITokenThemeRule[] {
  return [
    { token: 'keyword.scene', foreground: 'e06c75', fontStyle: 'bold' },
    { token: 'entity.name.character', foreground: '61afef', fontStyle: 'bold' },
    { token: 'comment.narration', foreground: '98c379', fontStyle: 'italic' },
    { token: 'string.dialogue', foreground: 'e5c07b' },
    { token: 'keyword.choice', foreground: 'c678dd' },
    { token: 'string.choice-text', foreground: 'c678dd' },
    { token: 'keyword.heading', foreground: 'e06c75', fontStyle: 'bold' },
    { token: 'comment.blockquote', foreground: '5c6370', fontStyle: 'italic' },
    { token: 'meta.content', foreground: '56b6c2' },
    { token: 'attribute.name', foreground: 'e06c75' },
    { token: 'attribute.value', foreground: '98c379' },
  ]
}

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

/**
 * Register the ADV language and theme with a Monaco instance.
 */
export function registerAdvLanguage(
  monaco: typeof Monaco,
  getContext: () => AdvCompletionContext,
): void {
  // Register language if not already registered
  const existingLangs = monaco.languages.getLanguages()
  if (!existingLangs.some(l => l.id === ADV_LANGUAGE_ID)) {
    monaco.languages.register({
      id: ADV_LANGUAGE_ID,
      extensions: ['.adv.md'],
      aliases: ['ADV Script', 'adv'],
      mimetypes: ['text/x-adv-markdown'],
    })
  }

  // Set tokenizer
  monaco.languages.setMonarchTokensProvider(ADV_LANGUAGE_ID, getAdvTokensProvider())

  // Set completion provider
  monaco.languages.registerCompletionItemProvider(
    ADV_LANGUAGE_ID,
    createAdvCompletionProvider(getContext),
  )

  // Define custom theme with ADV token colors
  monaco.editor.defineTheme('adv-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: getAdvThemeRules(),
    colors: {},
  })

  monaco.editor.defineTheme('adv-light', {
    base: 'vs',
    inherit: true,
    rules: getAdvThemeRules().map(r => ({
      ...r,
      // Slightly adjust colors for light theme
      foreground: r.foreground,
    })),
    colors: {},
  })
}
