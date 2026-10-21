import type * as Monaco from 'monaco-editor'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { projectFileLanguage } from '../../../editor/core/app/utils/project-files'
import advPalette from '../../../packages/parser/syntaxes/adv.palette.json'
import { ADV_LANGUAGE_ID, ADV_MONACO_THEMES, advMonacoTheme, advMonacoThemeRules, createAdvTokensProvider, registerAdvMonacoLanguage } from '../../../packages/shared/adv-monaco'

const hello = readFileSync(resolve(import.meta.dirname, '../../../demo/starter/public/md/chapters/hello.adv.md'), 'utf8')

async function tokenize(source: string) {
  const provider = await createAdvTokensProvider()
  let state = provider.getInitialState()
  return source.split('\n').map((line) => {
    const result = provider.tokenize(line, state)
    state = result.endState
    return result.tokens
      .map((token, index) => [line.slice(token.startIndex, result.tokens[index + 1]?.startIndex).trim(), token.scopes] as const)
      .filter(([text]) => text)
  })
}

function fakeMonaco() {
  return {
    languages: { register: vi.fn(), registerTokensProviderFactory: vi.fn() },
    editor: { defineTheme: vi.fn() },
  }
}

describe('editor ADV script highlighting', () => {
  it('opens .adv.md scripts with the ADV language and other files as before', () => {
    expect(projectFileLanguage('adv/chapters/hello.adv.md')).toBe(ADV_LANGUAGE_ID)
    expect(projectFileLanguage('HELLO.ADV.MD')).toBe(ADV_LANGUAGE_ID)
    expect(projectFileLanguage('adv/characters/xiaoyun.character.md')).toBe('markdown')
    expect(projectFileLanguage('README.md')).toBe('markdown')
    expect(projectFileLanguage('adv.config.json')).toBe('json')
    expect(projectFileLanguage('setup/main.ts')).toBe('typescript')
    expect(projectFileLanguage('theme.scss')).toBe('css')
    expect(projectFileLanguage('notes.txt')).toBe('plaintext')
    expect(advMonacoTheme(true)).toBe('adv-dark')
    expect(advMonacoTheme(false)).toBe('adv-light')
  })

  it('colors ADV roles in the starter chapter', async () => {
    const lines = await tokenize(hello)
    const line = (text: string) => lines[hello.split('\n').indexOf(text)]

    expect(line('---')).toEqual([['---', 'delimiter.adv']])
    expect(line('title: 你好，ADV.JS')).toEqual([['title', 'key.yaml.adv'], [':', ''], ['你好，ADV.JS', 'string.yaml']])
    expect(line('【演示室，清晨，内景】 {#start}')).toEqual([['【演示室，清晨，内景】', 'keyword.scene.adv'], ['{#start}', 'variable.anchor.adv']])
    expect(line('@向导')).toEqual([['@向导', 'type.speaker.adv']])
    expect(line('> 这段旁白直接来自一个 `.adv.md` 文件。')).toEqual([
      ['>', 'delimiter.adv'],
      ['这段旁白直接来自一个', 'comment.narration.adv'],
      ['`.adv.md`', 'variable.source.md'],
      ['文件。', 'comment.narration.adv'],
    ])
    expect(line('- [打开窗边的来信](letter#window)')).toEqual([
      ['-', 'delimiter.adv'],
      ['[', 'delimiter.adv'],
      ['打开窗边的来信', 'string.choice.adv'],
      ['](', 'delimiter.adv'],
      ['letter#window', 'variable.anchor.adv'],
      [')', 'delimiter.adv'],
    ])
    expect(line('## 语法提示 {#syntax}')).toEqual([['##', 'delimiter.adv'], ['语法提示', 'strong.heading.adv'], ['{#syntax}', 'variable.anchor.adv']])
    expect(line('    value: true')).toEqual([['value', 'key.yaml.adv'], [':', ''], ['true', 'keyword']])
    // Fences sit on almost every choice; leave them in the editor foreground.
    expect(line('```yaml')).toEqual([['```yaml', '']])
    expect(line('[^advjs]: 使用 **Markdown** 编写文字冒险故事的开源引擎。')).toEqual([
      ['[^', 'delimiter.adv'],
      ['advjs', 'variable.anchor.adv'],
      [']', 'delimiter.adv'],
      [': 使用', ''],
      ['**Markdown**', 'strong.md'],
      ['编写文字冒险故事的开源引擎。', ''],
    ])
  })

  it('separates speaker status, parenthesized narration, line ids, checkboxes and comments', async () => {
    const [dialogue, narration, checkbox, comment] = await tokenize('@小云（微笑）\n（她笑了） {#line_0190}\n- [ ] 普通选项\n<!-- note -->')
    expect(dialogue).toEqual([['@小云', 'type.speaker.adv'], ['（微笑）', 'type.status.adv']])
    expect(narration).toEqual([['（她笑了）', 'comment.narration.adv'], ['{#line_0190}', 'delimiter.adv']])
    expect(checkbox).toEqual([['-', 'delimiter.adv'], ['[ ]', 'delimiter.adv'], ['普通选项', 'string.choice.adv']])
    expect(comment).toEqual([['<!-- note -->', 'delimiter.adv']])
  })

  it('builds the light and dark themes from the shared ADV palette', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const rules = advMonacoThemeRules(scheme)
      const palette: Record<string, string> = advPalette.palettes[scheme]
      for (const [role, { fontStyle }] of Object.entries(advPalette.roles) as [string, { fontStyle?: string }][]) {
        const rule = rules[Object.keys(advPalette.roles).indexOf(role)]
        expect(rule?.foreground, `${scheme} ${role}`).toBe(palette[role]?.slice(1))
        expect(rule?.fontStyle, `${scheme} ${role}`).toBe(fontStyle ?? '')
      }
      const distinct = ['scene', 'speaker', 'narration', 'choice', 'anchor', 'muted'].map(role => palette[role])
      expect(new Set(distinct).size).toBe(distinct.length)
    }
    expect(advMonacoThemeRules('dark').find(rule => rule.token === 'strong.heading.adv')).toEqual({ token: 'strong.heading.adv', fontStyle: 'bold' })
    // Frontmatter keys stay neutral instead of Monaco's teal, which reads like a speaker.
    for (const scheme of ['light', 'dark'] as const) {
      const key = advMonacoThemeRules(scheme).find(rule => rule.token === 'key.yaml.adv')
      expect(key?.foreground).toMatch(/^[0-9a-f]{6}$/)
      expect(Object.values(advPalette.palettes[scheme]).map(color => color.slice(1))).not.toContain(key?.foreground)
    }
  })

  it('registers the language and themes once per Monaco instance', async () => {
    const monaco = fakeMonaco()
    expect(registerAdvMonacoLanguage(monaco as unknown as typeof Monaco)).toBe(true)
    expect(registerAdvMonacoLanguage(monaco as unknown as typeof Monaco)).toBe(false)
    expect(monaco.languages.register).toHaveBeenCalledOnce()
    expect(monaco.languages.register).toHaveBeenCalledWith(expect.objectContaining({ id: ADV_LANGUAGE_ID, extensions: ['.adv.md'] }))
    expect(monaco.languages.registerTokensProviderFactory).toHaveBeenCalledOnce()
    expect(monaco.editor.defineTheme.mock.calls.map(([name, theme]) => [name, theme.base, theme.inherit])).toEqual([
      [ADV_MONACO_THEMES.light, 'vs', true],
      [ADV_MONACO_THEMES.dark, 'vs-dark', true],
    ])

    // The grammar loads only when Monaco first tokenizes an `adv` model.
    const [language, factory] = monaco.languages.registerTokensProviderFactory.mock.calls[0]!
    expect(language).toBe(ADV_LANGUAGE_ID)
    const provider = await factory.create()
    expect(provider.tokenize('@向导', provider.getInitialState()).tokens).toEqual([{ startIndex: 0, scopes: 'type.speaker.adv' }])

    expect(registerAdvMonacoLanguage(fakeMonaco() as unknown as typeof Monaco)).toBe(true)
  })
})
