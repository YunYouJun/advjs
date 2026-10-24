import type * as Monaco from 'monaco-editor'
import { describe, expect, it, vi } from 'vitest'
import { ADV_LANGUAGE_ID, createAdvCompletionProvider, registerAdvLanguage } from '../utils/advLanguage'
import { detectEditorLanguage } from '../utils/editorLanguage'

function fakeMonaco() {
  return {
    languages: { register: vi.fn(), registerTokensProviderFactory: vi.fn(), registerCompletionItemProvider: vi.fn() },
    editor: { defineTheme: vi.fn() },
  }
}

const context = () => ({ characterNames: ['小云'], sceneNames: ['教室'], locationNames: ['学校'] })

function completionItems(line: string, wordStartColumn = line.length + 1) {
  const model = {
    getLineContent: () => line,
    getWordUntilPosition: () => ({ startColumn: wordStartColumn, endColumn: line.length + 1 }),
  }
  const result = createAdvCompletionProvider(context).provideCompletionItems(
    model as unknown as Monaco.editor.ITextModel,
    { lineNumber: 1, column: line.length + 1 } as Monaco.Position,
    {} as Monaco.languages.CompletionContext,
    {} as Monaco.CancellationToken,
  ) as Monaco.languages.CompletionList
  return result.suggestions
}

function complete(line: string) {
  return completionItems(line).map(item => item.label)
}

describe('detectEditorLanguage', () => {
  it('opens .adv.md scripts with the ADV language', () => {
    expect(detectEditorLanguage('chapters/hello.adv.md')).toBe(ADV_LANGUAGE_ID)
    expect(detectEditorLanguage('HELLO.ADV.MD')).toBe(ADV_LANGUAGE_ID)
  })

  it('keeps the other mappings and falls back to the given language', () => {
    expect(detectEditorLanguage('adv/characters/xiaoyun.character.md')).toBe('markdown')
    expect(detectEditorLanguage('adv.config.json')).toBe('json')
    expect(detectEditorLanguage('scene.yml')).toBe('yaml')
    expect(detectEditorLanguage('notes.txt')).toBe('plaintext')
    expect(detectEditorLanguage('notes.txt', 'markdown')).toBe('markdown')
    expect(detectEditorLanguage('', 'json')).toBe('json')
  })
})

describe('registerAdvLanguage', () => {
  it('registers the TextMate language, themes and completions once per Monaco instance', () => {
    const monaco = fakeMonaco()
    expect(registerAdvLanguage(monaco as unknown as typeof Monaco, context)).toBe(true)
    expect(registerAdvLanguage(monaco as unknown as typeof Monaco, context)).toBe(false)

    expect(monaco.languages.register).toHaveBeenCalledOnce()
    expect(monaco.languages.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'adv', extensions: ['.adv.md'] }))
    expect(monaco.languages.registerTokensProviderFactory).toHaveBeenCalledOnce()
    expect(monaco.editor.defineTheme.mock.calls.map(([name]) => name)).toEqual(['adv-light', 'adv-dark'])
    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledOnce()
    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith('adv', expect.objectContaining({ triggerCharacters: expect.arrayContaining(['@', '【']) }))
  })

  it('completes speakers after @ and scene or location names inside 【】', () => {
    expect(complete('@')).toEqual(['@小云'])
    expect(complete('【')).toEqual(['教室', '学校'])
  })

  it.each([
    ['【', 1, '【教室'],
    ['【教', 1, '【教室'],
    ['【别处，教', 1, '【别处，教室'],
    ['【别处,教', 5, '【别处,教室'],
    ['【 教', 3, '【 教室'],
  ])('keeps scene delimiters outside the completion filter for %s', (line, wordStartColumn, expected) => {
    // Monaco's default word definition includes full-width punctuation in
    // words, so its range can start before 【 or ， even at an empty name.
    const [scene, location] = completionItems(line, wordStartColumn)
    for (const item of [scene!, location!]) {
      const range = item.range as Monaco.IRange
      const prefix = line.slice(range.startColumn - 1, range.endColumn - 1)
      expect(prefix).not.toMatch(/[【，,]/)
      expect(range.endColumn).toBe(line.length + 1)
    }
    const range = scene!.range as Monaco.IRange
    expect(line.slice(0, range.startColumn - 1) + scene!.insertText).toBe(expected)
  })
})
