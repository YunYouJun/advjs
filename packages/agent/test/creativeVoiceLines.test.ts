import { compileProject } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { matchesCreativeVoiceLineSource, parseCreativePartnerOutput, parseCreativePartnerOutputSnapshot } from '../src'
import { creativePlan } from './helpers/creative-team'

const lineId = 'line_01900400-0000-7000-8000-000000000001'
const otherId = 'line_01900400-0000-7000-8000-000000000002'
const narratorId = 'line_01900400-0000-7000-8000-000000000003'
const path = 'adv/chapters/intro.chapter.json'
const content = '同一句对白，有两个不同的稳定身份。'
const chapter = { schemaVersion: 1, id: 'intro', title: '稳定 Flow 对白', nodes: [{ id: 'station', type: 'dialogues', dialogues: [{ speakerId: 'lin', text: content, lineId: otherId }, { speaker: '林', text: content, lineId }] }, { id: 'narration', type: 'narration', text: '雨停了。', lineId: narratorId }] }
const context = { projectId: 'station', projectRevision: 'fixture', characterIds: ['lin'], limits: creativePlan().limits, files: { 'adv.config.json': '{"schemaVersion":1,"root":"adv","format":"flow"}', 'adv/characters/lin.character.md': '---\nid: lin\nname: 林\naliases: [林舟]\n---\n角色。', [path]: JSON.stringify(chapter, null, 2) } }
const output = { kind: 'voice-direction', summary: '第二句 Flow 对白与独立旁白', cast: [{ speakerId: 'lin', designBrief: '克制', performance: '平静' }, { speakerId: 'narrator', designBrief: '独立旁白', performance: '中性' }], dictionary: [], lines: [{ path, lineId, speakerId: 'lin', text: content, instruction: '低声' }, { path, lineId: narratorId, speakerId: 'narrator', text: '雨停了。', instruction: '独立旁白' }] }

describe('stable Flow voice source handoffs', () => {
  it('matches pretty-printed JSON, repeated dialogue and independent narration to actual compiled nodes', async () => {
    expect(parseCreativePartnerOutput('voice-direction', output, context)).toEqual(output)
    const result = await compileProject({ id: context.projectId, files: context.files })
    expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    expect(result.project.program!.chapters.intro!.nodes['station.dialog-2']!.data).toMatchObject({ speakerId: 'lin', text: content, lineId })
    expect(result.project.program!.chapters.intro!.nodes.narration!.data).toMatchObject({ speakerId: 'narrator', lineId: narratorId })
    expect(result.sourceMap.nodes!['intro#station.dialog-2']!.line).toBeUndefined()
    expect(matchesCreativeVoiceLineSource(output.lines[0]!, context.files, otherId)).toBe(false)
  })

  it('rejects missing or duplicate identities, forged speakers/text and ambiguous mixed selectors', () => {
    for (const patch of [{ lineId: otherId, speakerId: 'narrator' }, { lineId: 'line_01900400-0000-7000-8000-000000000099' }, { lineId: 'guessed' }, { text: '不是源台词' }, { line: 1 }])
      expect(() => parseCreativePartnerOutput('voice-direction', { ...output, lines: [{ ...output.lines[0], ...patch }] }, context)).toThrow()
    expect(() => parseCreativePartnerOutput('voice-direction', { ...output, lines: [output.lines[0], output.lines[0]] }, context)).toThrow('Duplicate')
    const duplicated = structuredClone(chapter)
    duplicated.nodes[0]!.dialogues![0]!.lineId = lineId
    expect(() => parseCreativePartnerOutput('voice-direction', output, { ...context, files: { ...context.files, [path]: JSON.stringify(duplicated) } })).toThrow('frozen dialogue')
  })

  it('retains old snapshots for reading but requires a literal ID for new Flow plans', () => {
    const legacy = { ...output, lines: [{ path, line: 1, speakerId: 'lin', text: content, instruction: '旧物理行方案' }] }
    const files = { ...context.files, [path]: JSON.stringify(chapter) }
    expect(() => parseCreativePartnerOutput('voice-direction', legacy, { ...context, files })).toThrow('frozen dialogue')
    expect(parseCreativePartnerOutputSnapshot(legacy, { ...context, files: {} })).toEqual(legacy)
    expect(parseCreativePartnerOutputSnapshot(output, { ...context, files: {} })).toEqual(output)
  })

  it('keeps legacy Markdown registration bound to the target literal ID even when texts repeat', () => {
    const path = 'adv/chapters/intro.adv.md'
    const files = { [path]: `# 等车 {#start}\n\n@lin\n${content} {#${otherId}}\n\n@lin\n${content} {#${lineId}}` }
    const line = { path, line: 7, speakerId: 'lin', text: content, instruction: '低声' }
    expect(matchesCreativeVoiceLineSource(line, files, lineId)).toBe(true)
    expect(matchesCreativeVoiceLineSource(line, files, otherId)).toBe(false)
  })
})

describe('quoted stable Markdown voice sources', () => {
  const path = 'adv/chapters/intro.adv.md'
  function markdown(block: string) {
    return { ...context, files: { 'adv.config.json': '{"schemaVersion":1,"root":"adv","format":"adv-md"}', 'adv/characters/lin.character.md': context.files['adv/characters/lin.character.md'], [path]: `# 等车 {#start}\n\n${block}` } }
  }
  it.each(['\n', '\r\n'])('preserves a complete formatted dialogue block using %j source rows', async (newline) => {
    const block = `@lin\n列车还没有到，\n我们再**等一会儿**。 {#${lineId}}`
    const frozen = markdown(block)
    frozen.files[path] = frozen.files[path].replace(/\n/g, newline)
    const line = { path, lineId, source: { line: 3, endLine: 5, text: block }, speakerId: 'lin', text: '列车还没有到，\n我们再等一会儿。', instruction: '读完整段落' }
    const plan = { ...output, lines: [line] }
    expect(parseCreativePartnerOutput('voice-direction', plan, frozen)).toEqual(plan)
    expect(parseCreativePartnerOutputSnapshot(plan, { ...frozen, files: {} })).toEqual(plan)
    const compiled = await compileProject({ files: frozen.files })
    expect(compiled.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    const node = Object.values(compiled.project.program!.chapters.intro!.nodes).find(node => node.data?.lineId === lineId)!
    expect(node.data).toMatchObject({ speakerId: 'lin', text: line.text })
    expect(compiled.sourceMap.nodes![`intro#${node.id}`]).toMatchObject({ path, line: 3, endLine: 5 })
    expect(matchesCreativeVoiceLineSource(line, frozen.files, otherId)).toBe(false)
    expect(matchesCreativeVoiceLineSource(line, { ...frozen.files, [path]: frozen.files[path].replace('等一会儿', '走吧') })).toBe(false)
  })
  it.each(['\n', '\r\n'])('quotes multi-paragraph narration using the compiler’s existing %j display text', async (newline) => {
    const block = `> 雨没有停，\n> 灯在晃。\n>\n> 末班车仍没有来。 {#${narratorId}}`
    const frozen = markdown(block)
    frozen.files[path] = frozen.files[path].replace(/\n/g, newline)
    const line = { path, lineId: narratorId, source: { line: 3, endLine: 6, text: block }, speakerId: 'narrator', text: `雨没有停，${newline}灯在晃。\n末班车仍没有来。`, instruction: '独立旁白' }
    expect(parseCreativePartnerOutput('voice-direction', { ...output, lines: [line] }, frozen)).toMatchObject({ lines: [line] })
    const compiled = await compileProject({ files: frozen.files })
    expect(compiled.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    const node = Object.values(compiled.project.program!.chapters.intro!.nodes).find(node => node.data?.lineId === narratorId)!
    expect(node.data).toMatchObject({ speakerId: 'narrator', text: line.text })
    expect(compiled.sourceMap.nodes![`intro#${node.id}`]).toMatchObject({ line: 3, endLine: 6 })
  })
  it('uses the quoted block rather than counting unrelated literal markers in fenced examples', async () => {
    const block = `@lin\n你好。 {#${lineId}}`
    const frozen = markdown(`\`\`\`\n{#${lineId}}\n\`\`\`\n\n${block}`)
    const line = { path, lineId, source: { line: 7, endLine: 8, text: block }, speakerId: 'lin', text: '你好。', instruction: '实际台词' }
    expect(matchesCreativeVoiceLineSource(line, frozen.files, lineId)).toBe(true)
    const compiled = await compileProject({ files: frozen.files })
    expect(compiled.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    expect(Object.values(compiled.project.program!.chapters.intro!.nodes).filter(node => node.data?.lineId === lineId)).toHaveLength(1)
  })
  it('rejects missing, changed, reversed or overflowing quotes and mixed selector authority', () => {
    const block = `@lin\n你好。 {#${lineId}}`
    const frozen = markdown(block)
    const line = { path, lineId, source: { line: 3, endLine: 4, text: block }, speakerId: 'lin', text: '你好。', instruction: '完整原文' }
    for (const source of [undefined, { line: 4, endLine: 3, text: block }, { line: 3, endLine: 5, text: block }, { line: 3, endLine: 4, text: `${block}改字` }, { ...line.source, verification: 'model-certified' }])
      expect(() => parseCreativePartnerOutput('voice-direction', { ...output, lines: [{ ...line, source }] }, frozen)).toThrow()
    expect(() => parseCreativePartnerOutput('voice-direction', { ...output, lines: [{ ...line, line: 3 }] }, frozen)).toThrow()
    expect(() => parseCreativePartnerOutput('voice-direction', { ...output, lines: [{ ...line, lineId: undefined, line: 4 }] }, frozen)).toThrow()
    expect(() => parseCreativePartnerOutput('voice-direction', { ...output, lines: [{ ...output.lines[0], source: line.source }] }, context)).toThrow()
  })
})
