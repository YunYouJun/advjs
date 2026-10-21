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

function complete(line: string) {
  const model = {
    getLineContent: () => line,
    getWordUntilPosition: () => ({ startColumn: line.length + 1, endColumn: line.length + 1 }),
  }
  const result = createAdvCompletionProvider(context).provideCompletionItems(
    model as unknown as Monaco.editor.ITextModel,
    { lineNumber: 1, column: line.length + 1 } as Monaco.Position,
    {} as Monaco.languages.CompletionContext,
    {} as Monaco.CancellationToken,
  ) as Monaco.languages.CompletionList
  return result.suggestions.map(item => item.label)
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
})
