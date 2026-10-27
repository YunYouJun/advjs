import { isAudioId } from '@advjs/audio'
import { compileMarkdownProgram, prepareMarkdownVoiceIdentities } from '@advjs/core'
import { describe, expect, it } from 'vitest'

const retainedId = 'line_01900400-0000-7000-8000-000000000001'
const path = 'adv/chapters/station.adv.md'

describe('reviewed Markdown voice identity preparation', () => {
  it.each(['\n', '\r\n'])('preserves exact source bytes and compiled speech while assigning new identities with %j', async (newline) => {
    const content = ['# 车站 {#start}', '', `@lin\n相同对白。 {#${retainedId}}`, '', '@lin\n相同对白。', '', '@lin\n相同对白。', '', '> 列车还没有到，\n> 我们再**等一会儿**。', '', '（雨停了。）', '', '林舟：「普通正文不改写。」', '', '```markdown', `@lin\n示例中的标记。 {#${retainedId}}`, '```', ''].join('\n').replaceAll('\n', newline)
    const sources = { [path]: content }
    const result = await prepareMarkdownVoiceIdentities(sources)
    expect(result.retained).toBe(1)
    expect(result.assigned).toHaveLength(4)
    expect(new Set(result.assigned.map(item => item.lineId)).size).toBe(4)
    expect(result.assigned.every(item => isAudioId(item.lineId, 'line') && item.path === path)).toBe(true)
    let restored = result.files[path]!
    for (const { lineId } of result.assigned)
      restored = restored.replace(` {#${lineId}}`, '')
    expect(restored).toBe(content)
    expect(sources[path]).toBe(content)
    const compile = (source: string) => compileMarkdownProgram({ id: 'identity', chapters: [{ id: 'station', sourcePath: path, content: source }] })
    const [before, after] = await Promise.all([compile(content), compile(result.files[path]!)])
    expect(before.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    expect(after.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    const speech = (value: typeof before) => Object.values(value.program!.chapters.station!.nodes).filter(node => ['dialog', 'narration'].includes(node.kind))
    const stripIds = (value: typeof before) => speech(value).map(node => ({ kind: node.kind, data: Object.fromEntries(Object.entries(node.data!).filter(([key]) => key !== 'lineId')) }))
    expect(stripIds(after)).toEqual(stripIds(before))
    expect(speech(after).map(node => node.data!.lineId)).toEqual([retainedId, ...result.assigned.map(item => item.lineId)])
    const repeated = await prepareMarkdownVoiceIdentities(result.files)
    expect(repeated.files).toEqual(result.files)
    expect(repeated.assigned).toEqual([])
    expect(repeated.retained).toBe(5)
  })

  it('preserves inline glossary references and formatted source around the final marker', async () => {
    const content = '@lin\n看看**车站**[^station]。\n\n[^station]: 雨夜的站台。\n'
    const result = await prepareMarkdownVoiceIdentities({ [path]: content })
    expect(result.assigned).toHaveLength(1)
    expect(result.files[path]!.replace(` {#${result.assigned[0]!.lineId}}`, '')).toBe(content)
  })

  it('rejects duplicate existing identities across candidate chapters without rewriting either source', async () => {
    const sources = { [path]: `@lin\n保留。 {#${retainedId}}`, 'adv/chapters/other.adv.md': `> 另一句。 {#${retainedId}}` }
    const original = structuredClone(sources)
    await expect(prepareMarkdownVoiceIdentities(sources)).rejects.toThrow('ADV_VOICE_IDENTITY_DUPLICATE')
    expect(sources).toEqual(original)
  })

  it('refuses malformed markers and blocks a marker swallowed by non-prose quotation syntax', async () => {
    await expect(prepareMarkdownVoiceIdentities({ [path]: '@lin\n保留。 {#line_not-an-id}' })).rejects.toThrow()
    await expect(prepareMarkdownVoiceIdentities({ [path]: '> ```\n> ignored code\n> ```' })).rejects.toThrow('ADV_VOICE_IDENTITY_SEMANTICS_CHANGED')
  })
})
