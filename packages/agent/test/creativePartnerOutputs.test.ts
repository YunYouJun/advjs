import type { CreativeOutputContext } from '../src'
import { compileProject } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { creativeOutputFileChanges, overlayCreativeChanges, parseCreativePartnerOutput } from '../src'
import project from './fixtures/creative-team/v2/project.json'
import { creativePlan } from './helpers/creative-team'

const context: CreativeOutputContext = { projectId: 'station', projectRevision: 'r1', files: project.files, characterIds: ['lin', 'qiao'], limits: creativePlan().limits }
const character = { id: 'lin', name: '林舟', description: '失物招领员', motivation: '归还信封', speakingStyle: '谨慎、短句', visualConstraints: ['旧制服'], voiceConstraints: ['低声'], relationships: [{ targetId: 'qiao', type: '陌生人', description: '在车站相遇' }] }

describe('controlled six-partner outputs', () => {
  it('checks director scope and budget before a proposed plan can reach review', () => {
    expect(parseCreativePartnerOutput('production-plan', { kind: 'production-plan', summary: '双结局制作计划', plan: creativePlan() }, context).kind).toBe('production-plan')
    expect(() => parseCreativePartnerOutput('production-plan', { kind: 'production-plan', summary: '越界', plan: { ...creativePlan(), limits: { ...context.limits, maxMicroPoints: 100001 } } }, context)).toThrow(/approved limits/)
  })

  it('serializes a structured character as a portable reviewed source, preserving a stable relationship id', async () => {
    const output = parseCreativePartnerOutput('characters', { kind: 'characters', summary: '人物设定', characters: [character] }, context)
    const changes = creativeOutputFileChanges(output, context.files)
    expect(changes[0]).toMatchObject({ path: 'adv/characters/lin.character.md', before: context.files['adv/characters/lin.character.md'] })
    const compiled = await compileProject({ files: overlayCreativeChanges(context.files, changes) })
    expect(compiled.diagnostics).toEqual([])
    expect(() => parseCreativePartnerOutput('characters', { kind: 'characters', summary: '错误关系', characters: [{ ...character, relationships: [{ targetId: 'absent', type: '未知', description: '无' }] }] }, context)).toThrow(/unknown id/)
  })

  it('creates Chinese branching chapters without replacing opaque game settings', async () => {
    const source = { ...context.files, 'adv/settings/game.json': '{"entryChapterId":"station","custom":{"author":"kept"}}' }
    const output = parseCreativePartnerOutput('chapter', {
      kind: 'chapter',
      summary: '雨夜车站两个结局',
      entryChapterId: 'station',
      endingAddresses: project.specifiedEndings,
      chapters: ['station', 'stay', 'leave'].map(id => ({ id, title: id, content: source[`adv/chapters/${id}.adv.md` as keyof typeof source] })),
    }, { ...context, files: source })
    const files = overlayCreativeChanges(source, creativeOutputFileChanges(output, source))
    expect(JSON.parse(files['adv/settings/game.json']).custom).toEqual({ author: 'kept' })
    expect((await compileProject({ files })).diagnostics).toEqual([])
  })

  it('distinguishes art requests from produced media and validates stable identities', () => {
    const request = { assetId: 'background/station', kind: 'background', sceneId: 'station', locationId: 'station-place', width: 1920, height: 1080, prompt: '雨夜车站', constraints: ['冷灰色'] }
    const output = parseCreativePartnerOutput('art-direction', { kind: 'art-direction', summary: '待导入美术', style: '克制写实', requests: [{ ...request, generatedUrl: 'https://untrusted.invalid/fake.png' }] }, context)
    expect(creativeOutputFileChanges(output, context.files)).toEqual([])
    expect(JSON.stringify(output)).not.toContain('generatedUrl')
    expect(() => parseCreativePartnerOutput('art-direction', { kind: 'art-direction', summary: '错误人物', style: '写实', requests: [{ ...request, kind: 'portrait', characterId: 'absent' }] }, context)).toThrow(/character id/)
  })

  it('requires independent narrator casting and exact frozen dialogue before directing a line', () => {
    const value = { kind: 'voice-direction', summary: '待录音的配音方案', cast: [{ speakerId: 'narrator', designBrief: '旁白', performance: '平静' }, { speakerId: 'lin', designBrief: '低声', performance: '克制' }], dictionary: [], lines: [{ path: 'adv/chapters/station.adv.md', line: 3, speakerId: 'lin', text: '你在等谁？', instruction: '犹豫后发问' }] }
    expect(parseCreativePartnerOutput('voice-direction', value, context).kind).toBe('voice-direction')
    expect(() => parseCreativePartnerOutput('voice-direction', { ...value, cast: value.cast.slice(1) }, context)).toThrow(/Narrator/)
    expect(() => parseCreativePartnerOutput('voice-direction', { ...value, lines: [{ ...value.lines[0], text: '改掉的台词' }] }, context)).toThrow(/frozen dialogue/)
  })

  it('accepts proposed test inputs but refuses a model-authored execution report', () => {
    const output = { kind: 'playtest-plan', summary: '待实际试玩', scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }], concerns: [] }
    expect(parseCreativePartnerOutput('playtest-plan', output, context)).toMatchObject({ scenarios: [{ choices: [0] }, { choices: [1] }] })
    expect(() => parseCreativePartnerOutput('playtest-plan', { ...output, kind: 'playtest-report', passed: true }, context)).toThrow(/kind mismatch/)
  })
})
