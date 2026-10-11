import type { AdvAst } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { parseAst, stringifyDialogue } from '../src'

const id = 'line_019d137e-7abc-7000-8000-000000000001'

describe('stable dialogue line identity', () => {
  it.each(['\n', '\r\n'])('strips a final marker from formatted dialogue with %j separators and preserves it through serialization', async (separator) => {
    const ast = await parseAst(['@mitsuha(smile)', '你好，**又见面了**。', `明天见。 {#${id}}`].join(separator))
    const node = ast.children[0] as AdvAst.Dialog
    expect(node.lineId).toBe(id)
    expect(node.children).toEqual([{ type: 'text', value: '你好，又见面了。' }, { type: 'text', value: '明天见。' }])
    const repeated = await parseAst(stringifyDialogue(node))
    expect(repeated.children[0]).toMatchObject({ type: 'dialog', lineId: id, children: node.children })
  })

  it('retains glossary references and multiline text beside a stable voice identity', async () => {
    const glossary = '[^advjs]: 文字冒险引擎。'
    const ast = await parseAst(`@mitsuha(smile)\n你好，**ADV.JS[^advjs]**。\n明天见。 {#${id}}`, glossary)
    const node = ast.children[0] as AdvAst.Dialog
    expect(node.lineId).toBe(id)
    expect(node.children).toContainEqual(expect.objectContaining({ type: 'glossaryReference', identifier: 'advjs', definition: '文字冒险引擎。' }))
    expect(node.children.map(child => 'value' in child ? child.value : '').join('')).toBe('你好，ADV.JS[advjs]。\n明天见。')
    const repeated = (await parseAst(stringifyDialogue(node), glossary)).children[0] as AdvAst.Dialog
    expect(repeated).toMatchObject({ lineId: id, character: node.character })
    expect(repeated.children.map(child => 'value' in child ? child.value : '').join('')).toBe('你好，ADV.JS[advjs]。\n明天见。')
    expect(repeated.children).toContainEqual(expect.objectContaining({ type: 'glossaryReference', identifier: 'advjs', definition: '文字冒险引擎。' }))
  })

  it('preserves formatted multi-line narrator text and the same identity', async () => {
    const ast = await parseAst(`> 夜色**渐渐**沉下来。\n> 雨声响起。 {#${id}}`)
    const node = ast.children[0] as AdvAst.Narration
    expect(node).toMatchObject({ type: 'narration', lineId: id, children: ['夜色渐渐沉下来。', '雨声响起。'] })
    expect((await parseAst(stringifyDialogue(node))).children[0]).toMatchObject({ lineId: id, children: node.children })
  })

  it('supports parenthesized narration without exposing the marker', async () => {
    expect((await parseAst(`（雨声响起。） {#${id}}`)).children[0]).toMatchObject({ type: 'narration', lineId: id, children: ['雨声响起。'] })
  })

  it.each([
    'line_invalid',
    'line_019d137e-7abc-4000-8000-000000000001',
    `${id}} {#${id}`,
  ])('rejects malformed or multiple markers: %s', async (value) => {
    await expect(parseAst(`@mitsuha\n你好。 {#${value}}`)).rejects.toThrow(/UUIDv7/u)
  })

  it('rejects non-final and incomplete markers with source positions', async () => {
    await expect(parseAst(`## Intro\n\n@mitsuha\n你好。 {#${id}}\n继续。`)).rejects.toMatchObject({ code: 'ADV_RUNTIME_INVALID_LINE_ID', line: 3, column: 1 })
    await expect(parseAst('@mitsuha\n你好。 {#line_incomplete')).rejects.toThrow(/complete final/u)
  })

  it('does not derive an identity for an unbound line', async () => {
    expect((await parseAst('@mitsuha\n你好。')).children[0]).not.toHaveProperty('lineId')
  })
})
