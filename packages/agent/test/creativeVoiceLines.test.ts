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
