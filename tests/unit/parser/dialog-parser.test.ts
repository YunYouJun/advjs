import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mdParse, parseAst } from '../../../packages/parser/src'

const root = resolve(import.meta.dirname, '../../..')

describe('documented dialogue parsing', () => {
  it('matches the dialogue example in the syntax guide', async () => {
    const guide = readFileSync(resolve(root, 'docs/guide/advscript/syntax.md'), 'utf8')
    const section = guide.split('## 对话 Dialog')[1].split('## 人物 Character')[0]
    const markdown = section.match(/```md\n([\s\S]*?)\n```/)![1]
    const expected = JSON.parse(section.match(/```json\n([\s\S]*?)\n```/)![1])
    const ast = await parseAst(markdown)

    expect(ast.type).toBe('adv-root')
    expect(ast.children).toHaveLength(1)
    expect(ast.children[0]).toMatchObject(expected)
    expect(ast.children[0].position?.start).toEqual({ line: 1, column: 1, offset: 0 })
  })

  it('converts the issue #33 example while preserving the raw Markdown AST', async () => {
    const markdown = '@小云\nHello～'
    const raw = await mdParse(markdown)
    const adv = await parseAst(markdown)

    expect(raw.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: markdown }],
    })
    expect(adv.children[0]).toMatchObject({
      type: 'dialog',
      character: { type: 'character', name: '小云', status: '' },
      children: [{ type: 'text', value: 'Hello～' }],
    })
  })

  it('parses the real Doki Doki Love chapter', async () => {
    const chapter = readFileSync(resolve(root, 'demo/love/public/md/chapters/1/intro.adv.md'), 'utf8')
    const ast = await parseAst(chapter)

    expect(ast.children.find(node => node.type === 'dialog')).toMatchObject({
      type: 'dialog',
      character: { type: 'character', name: '小云', status: '' },
      children: [{ type: 'text', value: 'Hello～' }],
    })
  })

  it.each(['\n', '\r\n'])('preserves character status and multiple lines with %j separators', async (separator) => {
    const ast = await parseAst(['@小云（开心）', '你好呀！', '很高兴见到你。'].join(separator))

    expect(ast.children[0]).toMatchObject({
      type: 'dialog',
      character: { type: 'character', name: '小云', status: '开心' },
      children: [
        { type: 'text', value: '你好呀！' },
        { type: 'text', value: '很高兴见到你。' },
      ],
    })
  })

  it('retains glossary definitions in the ADV AST', async () => {
    const ast = await parseAst('@小云\n你好，ADV.JS[^advjs]！\n\n[^advjs]: 文字冒险引擎。')

    expect(ast.children[0]).toMatchObject({
      type: 'dialog',
      children: [
        { type: 'text', value: '你好，ADV.JS' },
        { type: 'glossaryReference', identifier: 'advjs', definition: '文字冒险引擎。' },
        { type: 'text', value: '！' },
      ],
    })
  })
})
